import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as crypto from "https://deno.land/std@0.208.0/crypto/mod.ts";

interface PaystackWebhookPayload {
  event: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    paid_at: string;
    status: string;
    customer: {
      email: string;
    };
    metadata?: {
      userId?: string;
      [key: string]: any;
    };
  };
}

/**
 * Verify Paystack webhook signature
 * Paystack sends an x-paystack-signature header with HMAC-SHA512 of the request body
 */
function verifyPaystackSignature(
  signature: string,
  body: string,
  secretKey: string
): boolean {
  try {
    // Create HMAC-SHA512 hash
    const encoder = new TextEncoder();
    const key = encoder.encode(secretKey);
    const message = encoder.encode(body);

    // Use crypto.subtle for HMAC-SHA512
    const hmac = crypto.createHmac("sha512", key);
    hmac.update(message);
    const hash = hmac.digest("hex");

    console.log("Signature verification:", {
      received: signature,
      computed: hash,
      match: signature === hash,
    });

    return signature === hash;
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
}

/**
 * Handle Paystack webhook events
 * Currently handles:
 * - charge.success: Update transaction status to success
 */
async function handlePaystackWebhook(req: Request): Promise<Response> {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get Paystack signature from headers
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      console.warn("Missing x-paystack-signature header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get environment variables
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!paystackSecretKey || !supabaseUrl || !supabaseServiceKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Read and parse request body
    const bodyText = await req.text();
    const payload: PaystackWebhookPayload = JSON.parse(bodyText);

    // Verify signature
    const isValidSignature = verifyPaystackSignature(
      signature,
      bodyText,
      paystackSecretKey
    );

    if (!isValidSignature) {
      console.error("Invalid Paystack signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Webhook event received:", {
      event: payload.event,
      reference: payload.data.reference,
      status: payload.data.status,
    });

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle charge.success event
    if (payload.event === "charge.success") {
      const { reference, status, data } = payload.data;

      // Verify transaction status is success
      if (status !== "success") {
        console.warn("Transaction status is not success:", {
          reference,
          status,
        });
        return new Response(
          JSON.stringify({
            success: true,
            message: "Event received but transaction not successful",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Update transaction status in database
      const { data: updatedTransaction, error: updateError } = await supabase
        .from("payment_transactions")
        .update({
          status: "success",
          verified_at: new Date().toISOString(),
        })
        .eq("reference", reference)
        .select();

      if (updateError) {
        console.error("Error updating transaction status:", {
          reference,
          error: updateError,
        });
        return new Response(
          JSON.stringify({
            error: "Failed to update transaction",
            details: updateError.message,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!updatedTransaction || updatedTransaction.length === 0) {
        console.warn("Transaction not found in database:", { reference });
        return new Response(
          JSON.stringify({
            error: "Transaction reference not found",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      console.log("Transaction updated successfully:", {
        reference,
        transactionId: updatedTransaction[0].id,
        newStatus: "success",
      });

      // TODO: Add additional business logic here:
      // - Create booking record
      // - Update user wallet/ledger
      // - Send confirmation notification
      // - Create audit log

      return new Response(
        JSON.stringify({
          success: true,
          message: "Transaction verified and updated",
          reference,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle charge.failed event (optional)
    if (payload.event === "charge.failed") {
      const { reference } = payload.data;

      // Update transaction status to failed
      const { error: updateError } = await supabase
        .from("payment_transactions")
        .update({
          status: "failed",
          verified_at: new Date().toISOString(),
        })
        .eq("reference", reference);

      if (updateError) {
        console.error("Error marking transaction as failed:", {
          reference,
          error: updateError,
        });
      } else {
        console.log("Transaction marked as failed:", { reference });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Failed transaction recorded",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // For other events, just acknowledge receipt
    console.log("Unhandled webhook event:", payload.event);
    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook received",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in paystack-webhook:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

serve(handlePaystackWebhook);
