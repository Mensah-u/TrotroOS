import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { supabase } from '../services/supabase';
import { usePaystackPayment } from '../hooks/usePaystackPayment';

interface BookingPaymentScreenProps {
  seatFare: number;
  route?: any;
  navigation?: any;
}

/**
 * Sample implementation of the Paystack payment flow
 * Shows how to integrate usePaystackPayment hook in a real screen
 */
export function BookingPaymentScreen({
  seatFare,
  route,
  navigation,
}: BookingPaymentScreenProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { processPayment, isLoading, error } = usePaystackPayment();

  // Calculate payment breakdown on mount
  useEffect(() => {
    calculatePaymentBreakdown();
    fetchCurrentUser();
  }, [seatFare]);

  /**
   * Calculate the payment breakdown for display
   */
  const calculatePaymentBreakdown = () => {
    // Platform fee: 8% of seat fare
    const platformFee = seatFare * 0.08;
    // Request fee: Fixed 1 GHS
    const requestFee = 1.0;
    // Total
    const total = seatFare + platformFee + requestFee;

    setPaymentBreakdown({
      seatFare: parseFloat(seatFare.toFixed(2)),
      platformFee: parseFloat(platformFee.toFixed(2)),
      requestFee: requestFee,
      total: parseFloat(total.toFixed(2)),
    });
  };

  /**
   * Get current authenticated user
   */
  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
      } else {
        Alert.alert('Error', 'Please log in to continue');
        navigation?.goBack();
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      Alert.alert('Error', 'Failed to fetch user information');
    }
  };

  /**
   * Handle payment button press
   */
  const handlePayment = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    if (!currentUser.email) {
      Alert.alert('Error', 'User email is required for payment');
      return;
    }

    if (!paymentBreakdown) {
      Alert.alert('Error', 'Failed to calculate payment amount');
      return;
    }

    setIsProcessing(true);

    try {
      console.log('Initiating payment:', {
        userId: currentUser.id,
        seatFare: paymentBreakdown.seatFare,
        email: currentUser.email,
      });

      // Call the payment processing function
      const result = await processPayment(
        currentUser.id,
        paymentBreakdown.seatFare,
        currentUser.email
      );

      console.log('Payment result:', result);

      // Handle the result
      if (result.status === 'success') {
        // Payment was successful
        Alert.alert(
          'Payment Successful',
          `Your booking has been confirmed!\nReference: ${result.reference}`,
          [
            {
              text: 'Go to Bookings',
              onPress: () => {
                navigation?.replace('Bookings');
              },
            },
          ]
        );
      } else if (result.status === 'cancelled') {
        // User cancelled the payment
        Alert.alert('Payment Cancelled', result.message);
      } else {
        // Payment failed
        Alert.alert('Payment Failed', result.message);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error processing payment:', err);
      Alert.alert('Payment Error', errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!paymentBreakdown) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Review Booking</Text>
        <Text style={styles.headerSubtitle}>Complete your payment to confirm</Text>
      </View>

      {/* Payment Breakdown Card */}
      <View style={styles.breakdownCard}>
        <Text style={styles.breakdownTitle}>Payment Breakdown</Text>

        {/* Seat Fare */}
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Seat Fare</Text>
          <Text style={styles.breakdownValue}>₦{paymentBreakdown.seatFare.toFixed(2)}</Text>
        </View>

        {/* Platform Fee */}
        <View style={styles.breakdownRow}>
          <View>
            <Text style={styles.breakdownLabel}>Platform Fee</Text>
            <Text style={styles.breakdownSubtext}>(8% of seat fare)</Text>
          </View>
          <Text style={styles.breakdownValue}>₦{paymentBreakdown.platformFee.toFixed(2)}</Text>
        </View>

        {/* Request Fee */}
        <View style={styles.breakdownRow}>
          <View>
            <Text style={styles.breakdownLabel}>Request Fee</Text>
            <Text style={styles.breakdownSubtext}>(Fixed charge)</Text>
          </View>
          <Text style={styles.breakdownValue}>₦{paymentBreakdown.requestFee.toFixed(2)}</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Total */}
        <View style={styles.breakdownRow}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalValue}>₦{paymentBreakdown.total.toFixed(2)}</Text>
        </View>
      </View>

      {/* User Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Payment Method</Text>
        <Text style={styles.infoText}>Email: {currentUser?.email}</Text>
        <Text style={styles.infoSubtext}>
          You will be redirected to Paystack to complete the payment securely
        </Text>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Important Notice */}
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>⚠️ Important</Text>
        <Text style={styles.noticeText}>
          • Keep your browser open after payment to receive confirmation{'\n'}
          • A confirmation email will be sent to {currentUser?.email}{'\n'}
          • Your booking will appear in your bookings immediately after payment
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation?.goBack()}
          disabled={isLoading || isProcessing}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.payButton,
            (isLoading || isProcessing) && styles.payButtonDisabled,
          ]}
          onPress={handlePayment}
          disabled={isLoading || isProcessing}
        >
          {isLoading || isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.payButtonText}>
              Pay ₦{paymentBreakdown.total.toFixed(2)} with Paystack
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Security Info */}
      <View style={styles.securityInfo}>
        <Text style={styles.securityText}>
          🔒 Your payment is secured by Paystack. Your card details are never stored on our servers.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  breakdownCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  breakdownSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066cc',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0066cc',
  },
  infoCard: {
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066cc',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 12,
    color: '#666',
  },
  errorCard: {
    backgroundColor: '#fee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#cc0000',
  },
  errorText: {
    fontSize: 13,
    color: '#cc0000',
    fontWeight: '500',
  },
  noticeCard: {
    backgroundColor: '#fff9e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff9800',
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  payButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    backgroundColor: '#0066cc99',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  securityInfo: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  securityText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
});
