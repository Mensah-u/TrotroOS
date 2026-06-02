import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { v4 as uuidv4 } from "https://deno.land/std@0.208.0/uuid/mod.ts";

interface InitializePaymentRequest {
  userId: string;
  seatFare: number;
  email: string;
}

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaymentCalculation {
  seatFareInPesewas: number;
  platformFeeInPesewas: number;
  requestFeeInPesewas: number;
  totalInPesewas: number;
  platformFeeGHS: number;
  requestFeeGHS: number;
}

/**
 * Calculate payment amounts with exact numeric precision
 * All calculations are done in pesewas (GHS * 100) to avoid floating-point errors
 *
 * Financial Rules:
 * - Request Fee: Fixed 1 GHS (100 pesewas)
 * - Platform Fee: 8% of seat fare
 * - Total: Seat Fare + Platform Fee + Request Fee
 */
function calculatePayment(seatFareGHS: number): PaymentCalculation {
  // Convert GHS to pesewas (multiply by 100) for exact integer arithmetic
  const seatFareInPesewas = Math.round(seatFareGHS * 100);
  
  // Platform fee: 8% of seat fare
  const platformFeeInPesewas = Math.round(seatFareInPesewas * 0.08);
  
  // Request fee: Fixed 1 GHS (100 pesewas)
  const requestFeeInPesewas = 100;
  
  // Total amount to charge
  const totalInPesewas = seatFareInPesewas + platformFeeInPesewas + requestFeeInPesewas;

  return {
    seatFareInPesewas,
    platformFeeInPesewas,
    requestFeeInPesewas,
    totalInPesewas,
    platformFeeGHS: platformFeeInPesewas / 100,
    requestFeeGHS: requestFeeInPesewas / 100,
  };
}

/**
 * Initialize payment with Paystack
 * This function:
 * 1. Validates input
 * 2. Calculates payment amounts securely
 * 3. Initializes transaction with Paystack
 * 4. Stores pending transaction in database
 * 5. Returns authorization URL to frontend
 */
async function initializePayment(req: Request): Promise<Response> {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: InitializePaymentRequest = await req.json();
    const { userId, seatFare, email } = body;

    // Validate inputs
    if (!userId || !seatFare || !email) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: userId, seatFare, email",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (seatFare <= 0) {
      return new Response(
        JSON.stringify({ error: "Seat fare must be greater than 0" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !paystackSecretKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate payment amounts
    const payment = calculatePayment(seatFare);

    console.log("Payment calculation:", {
      seatFareGHS: seatFare,
      seatFareInPesewas: payment.seatFareInPesewas,
      platformFeeGHS: payment.platformFeeGHS,
      platformFeeInPesewas: payment.platformFeeInPesewas,
      requestFeeGHS: payment.requestFeeGHS,
      requestFeeInPesewas: payment.requestFeeInPesewas,
      totalInPesewas: payment.totalInPesewas,
    });

    // Generate unique reference
    const reference = `TRO_${Date.now()}_${uuidv4().slice(0, 8)}`;

    // Prepare metadata for Paystack
    const metadata = {
      userId,
      seatFare,
      platformFee: payment.platformFeeGHS,
      requestFee: payment.requestFeeGHS,
      transactionType: "seat_booking",
    };

    // Initialize transaction with Paystack
    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${paystackSecretKey}`,
        },
        body: JSON.stringify({
          email,
          amount: payment.totalInPesewas,
          reference,
          metadata,
          callback_url: `${supabaseUrl}/functions/v1/paystack-webhook`,
        }),
      }
    );

    const paystackData: PaystackInitializeResponse = await paystackResponse.json();

    if (!paystackData.status) {
      console.error("Paystack initialization failed:", paystackData.message);
      return new Response(
        JSON.stringify({
          error: "Failed to initialize payment with Paystack",
          details: paystackData.message,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Store pending transaction in database
    const { error: insertError } = await supabase
      .from("payment_transactions")
      .insert({
        user_id: userId,
        reference,
        amount_in_pesewas: payment.totalInPesewas,
        seat_fare: seatFare,
        platform_fee: payment.platformFeeGHS,
        request_fee: payment.requestFeeGHS,
        status: "pending",
        paystack_authorization_url: paystackData.data?.authorization_url,
        customer_email: email,
        metadata,
      });

    if (insertError) {
      console.error("Failed to store transaction:", insertError);
      return new Response(
        JSON.stringify({
          error: "Failed to create payment transaction record",
          details: insertError.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Payment initialized successfully:", {
      reference,
      totalInPesewas: payment.totalInPesewas,
      userId,
    });

    // Return authorization URL and reference to frontend
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          authorization_url: paystackData.data?.authorization_url,
          access_code: paystackData.data?.access_code,
          reference,
          totalInPesewas: payment.totalInPesewas,
          totalInGHS: payment.totalInPesewas / 100,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error in initialize-payment:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

serve(initializePayment);
