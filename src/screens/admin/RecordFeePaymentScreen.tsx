import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { recordFeePayment } from '../../services/feeService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS, COLORS, RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'other'] as const;

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

interface RecordFeePaymentParams {
  feeId: number;
  studentName?: string | null;
  invoiceTitle?: string | null;
  totalAmount?: number;
  paidAmount?: number;
}

/**
 * Reached from AdminFeeReportsScreen by tapping an invoice row - the invoice
 * is always pre-selected (feeId + display context come in via route params),
 * there's no separate "search for an invoice" flow here. Collects an amount
 * (defaults to the remaining balance) and a payment method, then calls
 * admin_fee_record_payment. Available to both admin and Cashier accounts -
 * the backend enforces that with requireAdminOrAccountant.
 */
export default function RecordFeePaymentScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { token } = useAuth();
  const { t } = useLocale();

  const params = (route.params as RecordFeePaymentParams | undefined) ?? { feeId: 0 };
  const totalAmount = params.totalAmount ?? 0;
  const alreadyPaid = params.paidAmount ?? 0;
  const remaining = Math.max(0, totalAmount - alreadyPaid);

  const [amount, setAmount] = useState(remaining > 0 ? String(remaining) : '');
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methodLabel = (m: string) =>
    ({
      cash: t('record_fee_payment.method_cash', 'Cash'),
      card: t('record_fee_payment.method_card', 'Card'),
      bank_transfer: t('record_fee_payment.method_bank_transfer', 'Bank Transfer'),
      other: t('record_fee_payment.method_other', 'Other'),
    }[m] ?? m);

  const handleSubmit = async () => {
    if (!token || !params.feeId) return;
    const parsed = Number(amount);
    if (!amount.trim() || Number.isNaN(parsed) || parsed <= 0) {
      Alert.alert(
        t('record_fee_payment.almost_done', 'Almost done'),
        t('record_fee_payment.error_amount', 'Enter a valid amount greater than zero.'),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await recordFeePayment(token, params.feeId, parsed, method);
      Alert.alert(
        t('record_fee_payment.submitted_title', 'Payment recorded'),
        t('record_fee_payment.submitted_message', 'The payment has been recorded against this invoice.'),
      );
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        t('record_fee_payment.error_title', 'Could not record payment'),
        err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('record_fee_payment.header_title', 'Record Payment')}</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.summaryCard}>
          <Text style={styles.summaryStudent} numberOfLines={1}>
            {params.studentName ?? t('record_fee_payment.unknown_student', 'Unknown student')}
          </Text>
          <Text style={styles.summaryInvoice} numberOfLines={1}>{params.invoiceTitle ?? ''}</Text>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('record_fee_payment.total', 'Total')}</Text>
            <Text style={styles.summaryValue}>{money(totalAmount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('record_fee_payment.already_paid', 'Already paid')}</Text>
            <Text style={styles.summaryValue}>{money(alreadyPaid)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelStrong}>{t('record_fee_payment.remaining', 'Remaining')}</Text>
            <Text style={styles.summaryValueStrong}>{money(remaining)}</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>{t('record_fee_payment.amount_label', 'Amount to collect now')}</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0"
          placeholderTextColor={SUBTLE}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        <Text style={styles.fieldLabel}>{t('record_fee_payment.method_label', 'Payment method')}</Text>
        <View style={styles.methodRow}>
          {PAYMENT_METHODS.map((m) => {
            const active = method === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.methodChip, active && styles.methodChipActive]}
                onPress={() => setMethod(m)}
              >
                <Text style={[styles.methodChipText, active && styles.methodChipTextActive]}>{methodLabel(m)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>{t('record_fee_payment.submit', 'Record Payment')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { color: EMERALD, fontSize: 16, fontWeight: '600', marginLeft: 2 },
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },

  content: { padding: 16, paddingBottom: 40 },

  summaryCard: {
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 18,
    marginBottom: 20,
  ...SHADOW.level2,
  },
  summaryStudent: { fontSize: 17, fontWeight: '700', color: INK },
  summaryInvoice: { fontSize: 13, color: SUBTLE, marginTop: 2 },
  summaryDivider: { height: 1, backgroundColor: HAIRLINE, marginVertical: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13.5, color: SUBTLE },
  summaryValue: { fontSize: 13.5, color: INK, fontWeight: '600' },
  summaryLabelStrong: { fontSize: 14.5, color: INK, fontWeight: '700' },
  summaryValueStrong: { fontSize: 16, color: EMERALD, fontWeight: '800' },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 8, marginTop: 6 },
  amountInput: {
    backgroundColor: GLASS_SURFACE,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '700',
    color: INK,
    marginBottom: 20,
  },

  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  methodChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: GLASS_SURFACE,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  methodChipActive: { backgroundColor: EMERALD, borderColor: EMERALD },
  methodChipText: { fontSize: 13, fontWeight: '600', color: SUBTLE },
  methodChipTextActive: { color: '#FFFFFF' },

  submitButton: {
    backgroundColor: EMERALD,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
