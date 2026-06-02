# Paystack Payment Integration Setup Guide

## Overview

This guide explains how to set up and configure the Paystack payment integration for TrotroOS. The system handles mobile money payments securely with exact financial calculations to prevent rounding errors.

## Architecture

### Components

1. **Database**: `payment_transactions` table in Supabase
2. **Backend**: Two Supabase Edge Functions
   - `initialize-payment`: Initiates payment with Paystack
   - `paystack-webhook`: Handles Paystack webhook events
3. **Frontend**: `usePaystackPayment` React Native hook for Expo

### Payment Flow

```
User initiates payment
    ↓
Frontend calls initialize-payment edge function
    ↓
Backend calculates total amount (seat fare + 8% platform fee + 1 GHS request fee)
    ↓
Backend calls Paystack API to initialize transaction
    ↓
Frontend opens Paystack payment page in browser
    ↓
User completes payment on Paystack
    ↓
Paystack calls webhook on backend
    ↓
Backend verifies signature and updates transaction status
    ↓
Frontend polls database and displays result
```

## Financial Calculations

### Rules

- **Seat Fare**: Amount set by the driver/mate (in GHS)
- **Platform Fee**: 8% of seat fare
- **Request Fee**: Fixed 1 GHS
- **Total**: Seat Fare + (Seat Fare × 0.08) + 1 GHS

### Example

```
Seat Fare: 5 GHS
Platform Fee: 5 × 0.08 = 0.40 GHS
Request Fee: 1.00 GHS
Total: 5.00 + 0.40 + 1.00 = 6.40 GHS (640 pesewas)
```

## Environment Setup

### 1. Get Paystack Secret Key

1. Go to https://dashboard.paystack.com/settings/developer
2. Copy your **Secret Key** (not the Public Key)
3. Save it securely

### 2. Configure Supabase Environment Variables

Add these variables to your Supabase project:

**Via Supabase Dashboard:**
- Go to **Settings** → **Secrets** in your Supabase project
- Add new secrets:

```
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxx  (production)
                    or
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx  (testing)
```

**Locally (for testing edge functions):**

Create `.env.local` in the root:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
```

### 3. Deploy Edge Functions

Deploy the edge functions to Supabase:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy initialize-payment
supabase functions deploy paystack-webhook
```

Verify deployment:
```bash
supabase functions list
```

### 4. Apply Database Migration

Run the SQL migration to create the `payment_transactions` table:

**Option A: Via Supabase Dashboard**
1. Go to **SQL Editor**
2. Create a new query
3. Copy the entire content from `supabase/migrations/20260602_create_payment_transactions.sql`
4. Execute the query

**Option B: Via Supabase CLI**
```bash
supabase migration up
```

### 5. Configure Paystack Webhook

1. Log in to Paystack Dashboard: https://dashboard.paystack.com
2. Go to **Settings** → **Webhooks**
3. Add new webhook:
   - **URL**: `https://your-project.supabase.co/functions/v1/paystack-webhook`
   - **Events**: Select `charge.success` and `charge.failed`
4. Click **Add Webhook**

> Replace `your-project` with your actual Supabase project URL

## Frontend Usage

### Basic Implementation

```typescript
import { usePaystackPayment } from '../hooks/usePaystackPayment';
import { supabase } from '../services/supabase';

function BookingScreen() {
  const { processPayment, isLoading } = usePaystackPayment();

  const handleBookSeat = async () => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    // Initiate payment
    const result = await processPayment(
      user.id,
      5.00,  // Seat fare in GHS
      user.email || ''
    );

    if (result.status === 'success') {
      // Navigate to confirmation screen
      navigation.navigate('BookingConfirmation');
    }
  };

  return (
    <Button
      title={isLoading ? 'Processing...' : 'Book Seat & Pay'}
      onPress={handleBookSeat}
      disabled={isLoading}
    />
  );
}
```

### Advanced Usage

```typescript
const {
  isLoading,
  error,
  initializePayment,
  openPaymentBrowser,
  verifyPaymentStatus,
  processPayment,
} = usePaystackPayment();

// Manual control over each step
const manualPaymentFlow = async () => {
  // Step 1: Initialize
  const initResponse = await initializePayment(userId, seatFare, email);
  
  if (!initResponse?.success) {
    console.error('Init failed:', initResponse?.error);
    return;
  }

  // Step 2: Open browser
  const paymentResult = await openPaymentBrowser(
    initResponse.data.authorization_url,
    initResponse.data.reference
  );

  // Handle result
  console.log('Payment result:', paymentResult);
};
```

## Testing

### Test Paystack Cards

Paystack provides test cards for different scenarios:

| Card Number | CVV | Expiry | Result |
|-------------|-----|--------|--------|
| 4111111111111111 | 123 | 01/25 | Success |
| 5555555555554444 | 123 | 01/25 | Success |
| 5105105105105100 | 123 | 01/25 | Success |

### Test Flow

1. Use test Paystack keys
2. Run the app in development
3. Initiate a booking with seat fare amount
4. Use a test card from the table above
5. Check the `payment_transactions` table to verify status

### Debugging

Enable detailed logging:

```typescript
// In usePaystackPayment.ts, logs include:
console.log('Initializing payment:', { userId, seatFare, email });
console.log('Payment initialized successfully:', data.data);
console.log('Opening payment browser:', { reference });
console.log('Verifying payment status:', { reference });
console.log('Transaction found:', { reference, status });
```

Check Supabase function logs:
1. Go to **Functions** in Supabase Dashboard
2. Click on `initialize-payment` or `paystack-webhook`
3. View real-time logs

## Security Best Practices

### ✅ Implemented

- **Backend Calculation**: All amounts calculated on backend (never trust client)
- **Signature Verification**: Paystack webhooks verified with HMAC-SHA512
- **Row Level Security**: Users can only see their own transactions
- **Service Role Only**: Database writes only via edge functions
- **Exact Numeric Precision**: Integer pesewas used (no floating-point errors)

### ⚠️ Never Do

- ❌ Calculate payment amounts on the client
- ❌ Hardcode secret keys in the app
- ❌ Skip signature verification on webhooks
- ❌ Store sensitive data in localStorage/AsyncStorage
- ❌ Log sensitive customer information

## Error Handling

### Common Issues

#### "Missing environment variables"
**Solution**: Check that PAYSTACK_SECRET_KEY is set in Supabase Secrets

#### "Invalid Paystack signature"
**Solution**: Verify webhook URL is correct and PAYSTACK_SECRET_KEY matches

#### "Transaction reference not found"
**Solution**: Webhook may not have processed yet. Check Supabase logs for errors

#### "Payment verification timeout"
**Solution**: Webhook may be delayed. Check Supabase function logs for errors

## Monitoring & Logging

### Database Queries

View all transactions:
```sql
SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT 20;
```

View pending transactions:
```sql
SELECT * FROM payment_transactions WHERE status = 'pending';
```

View failed transactions:
```sql
SELECT * FROM payment_transactions WHERE status = 'failed';
```

### Webhook Testing

Test webhook locally:
```bash
curl -X POST http://localhost:3000/paystack-webhook \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: your-signature" \
  -d '{"event":"charge.success","data":{"reference":"TRO_1234567890"}}'
```

## Next Steps

### Post-Payment Business Logic

Add these features after successful payment:

1. **Create Booking Record**: Insert into `bookings` table
2. **Update User Wallet**: Debit from user balance
3. **Send Confirmation**: Email/SMS to user
4. **Driver Notification**: Notify driver of new booking
5. **Audit Log**: Record transaction for compliance

Example implementation location: `supabase/functions/paystack-webhook/index.ts` (see TODO comments)

## Support & Troubleshooting

- **Paystack Docs**: https://paystack.com/docs/payments/accept-payments/
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **Expo Web Browser**: https://docs.expo.dev/versions/latest/sdk/webbrowser/

## Deployment Checklist

- [ ] Set `PAYSTACK_SECRET_KEY` in production Supabase project
- [ ] Update webhook URL in Paystack to production domain
- [ ] Deploy edge functions to production
- [ ] Test with real Paystack keys in staging
- [ ] Enable HTTPS (required by Paystack)
- [ ] Set up monitoring and alerting
- [ ] Document payment procedures for support team
