import { useState, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';

export interface PaymentInitializeResponse {
  success: boolean;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
    totalInPesewas: number;
    totalInGHS: number;
  };
  error?: string;
  details?: string;
}

export interface PaymentResult {
  status: 'success' | 'failed' | 'cancelled';
  reference?: string;
  message: string;
}

/**
 * Custom hook for handling Paystack payment flow
 * Manages payment initialization and completion verification
 */
export function usePaystackPayment() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize payment with Paystack
   * @param userId - User ID making the payment
   * @param seatFare - Seat fare in GHS
   * @param email - Customer email for Paystack
   * @returns Payment result with authorization URL and reference
   */
  const initializePayment = useCallback(
    async (userId: string, seatFare: number, email: string): Promise<PaymentInitializeResponse | null> => {
      try {
        setIsLoading(true);
        setError(null);

        // Validate inputs
        if (!userId || !seatFare || !email) {
          const errorMsg = 'Missing required payment information';
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        if (seatFare <= 0) {
          const errorMsg = 'Invalid seat fare amount';
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        console.log('Initializing payment:', { userId, seatFare, email });

        // Call Supabase edge function
        const { data, error: functionError } = await supabase.functions.invoke(
          'initialize-payment',
          {
            body: {
              userId,
              seatFare,
              email,
            },
          }
        );

        if (functionError) {
          const errorMsg = functionError.message || 'Failed to initialize payment';
          setError(errorMsg);
          console.error('Edge function error:', functionError);
          return { success: false, error: errorMsg, details: functionError.message };
        }

        if (!data || !data.success) {
          const errorMsg = data?.error || 'Payment initialization failed';
          setError(errorMsg);
          return { success: false, error: errorMsg, details: data?.details };
        }

        console.log('Payment initialized successfully:', data.data);
        return data;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unexpected error during payment initialization';
        setError(errorMsg);
        console.error('Error in initializePayment:', err);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Open Paystack payment URL in web browser
   * @param authorizationUrl - URL from Paystack
   * @param reference - Transaction reference
   * @returns Payment result after browser closes
   */
  const openPaymentBrowser = useCallback(
    async (authorizationUrl: string, reference: string): Promise<PaymentResult> => {
      try {
        console.log('Opening payment browser:', { reference });

        // Open URL in Expo Web Browser
        const result = await WebBrowser.openBrowserAsync(authorizationUrl);

        console.log('Browser result:', result);

        if (result.type === 'dismiss' || result.type === 'cancel') {
          return {
            status: 'cancelled',
            reference,
            message: 'Payment cancelled by user',
          };
        }

        // After browser closes, verify transaction status from database
        const verificationResult = await verifyPaymentStatus(reference);
        return verificationResult;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to open payment page';
        console.error('Error in openPaymentBrowser:', err);
        return {
          status: 'failed',
          reference,
          message: errorMsg,
        };
      }
    },
    []
  );

  /**
   * Verify payment status from database
   * @param reference - Transaction reference
   * @returns Payment verification result
   */
  const verifyPaymentStatus = useCallback(async (reference: string): Promise<PaymentResult> => {
    try {
      console.log('Verifying payment status:', { reference });

      // Poll database for transaction status with timeout
      const maxAttempts = 10;
      const pollInterval = 2000; // 2 seconds
      let attempts = 0;

      while (attempts < maxAttempts) {
        const { data, error } = await supabase
          .from('payment_transactions')
          .select('status, id, amount_in_pesewas')
          .eq('reference', reference)
          .single();

        if (error) {
          console.warn(`Verification attempt ${attempts + 1} failed:`, error);
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
          }
          continue;
        }

        if (data) {
          console.log('Transaction found:', { reference, status: data.status });

          if (data.status === 'success') {
            return {
              status: 'success',
              reference,
              message: `Payment successful! Amount: ₦${(data.amount_in_pesewas / 100).toFixed(2)}`,
            };
          } else if (data.status === 'failed') {
            return {
              status: 'failed',
              reference,
              message: 'Payment failed. Please try again.',
            };
          } else if (data.status === 'pending') {
            // Still pending, wait and retry
            attempts++;
            if (attempts < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, pollInterval));
              continue;
            }
          }
        }

        attempts++;
      }

      // Timeout after max attempts
      return {
        status: 'cancelled',
        reference,
        message: 'Payment verification timeout. Please check your transaction status.',
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error verifying payment status';
      console.error('Error in verifyPaymentStatus:', err);
      return {
        status: 'failed',
        reference,
        message: errorMsg,
      };
    }
  }, []);

  /**
   * Complete payment flow (initialize + browser + verify)
   * @param userId - User ID making the payment
   * @param seatFare - Seat fare in GHS
   * @param email - Customer email
   * @returns Final payment result
   */
  const processPayment = useCallback(
    async (userId: string, seatFare: number, email: string): Promise<PaymentResult> => {
      try {
        // Step 1: Initialize payment
        const initResponse = await initializePayment(userId, seatFare, email);

        if (!initResponse?.success || !initResponse.data) {
          Alert.alert('Payment Error', initResponse?.error || 'Failed to initialize payment');
          return {
            status: 'failed',
            message: initResponse?.error || 'Failed to initialize payment',
          };
        }

        const { authorization_url, reference, totalInGHS } = initResponse.data;

        // Show confirmation before opening browser
        Alert.alert(
          'Confirm Payment',
          `Amount to pay: ₦${totalInGHS.toFixed(2)}\n\nYou will be redirected to Paystack to complete your payment.`,
          [
            {
              text: 'Cancel',
              onPress: () => {
                console.log('User cancelled payment confirmation');
              },
              style: 'cancel',
            },
            {
              text: 'Proceed to Payment',
              onPress: async () => {
                // Step 2: Open payment browser
                const result = await openPaymentBrowser(authorization_url, reference);

                // Step 3: Show result to user
                if (result.status === 'success') {
                  Alert.alert('Success', result.message, [{ text: 'OK' }]);
                } else if (result.status === 'cancelled') {
                  Alert.alert('Cancelled', result.message, [{ text: 'OK' }]);
                } else {
                  Alert.alert('Error', result.message, [{ text: 'OK' }]);
                }
              },
            },
          ]
        );

        return {
          status: 'success',
          reference: initResponse.data?.reference,
          message: 'Payment initialized',
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unexpected error during payment';
        Alert.alert('Payment Error', errorMsg);
        return {
          status: 'failed',
          message: errorMsg,
        };
      }
    },
    [initializePayment, openPaymentBrowser]
  );

  return {
    isLoading,
    error,
    initializePayment,
    openPaymentBrowser,
    verifyPaymentStatus,
    processPayment,
  };
}
