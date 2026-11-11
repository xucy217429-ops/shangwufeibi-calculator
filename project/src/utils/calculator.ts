import { CalculatorInputs, CalculationResult, TargetType } from '../types/calculator';

/**
 * Format currency with grouping and precision
 */
export function formatMoney(val: number | null | undefined, includeSymbol = true): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  const prefix = includeSymbol ? '¥' : '';
  return prefix + Math.round(val).toLocaleString('zh-CN');
}

/**
 * Format percentage with 2 decimal places
 */
export function formatPercent(val: number | null | undefined, isDecimal = true): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  const pct = isDecimal ? val * 100 : val;
  return pct.toFixed(2) + '%';
}

/**
 * Format ROI multiple with 2 decimals
 */
export function formatRoi(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return val.toFixed(2);
}

/**
 * Core calculation logic for commercial budget & fee ratios
 */
export function calculateCommercialMetrics(inputs: CalculatorInputs): CalculationResult {
  const roiText = String(inputs.payRoi ?? '').trim();
  const boothText = String(inputs.booth ?? '').trim();
  const rateText = String(inputs.rate ?? '').trim();
  const targetText = String(inputs.targetValue ?? '').trim();
  const returnText = String(inputs.ret ?? '').trim();
  const grossMarginText = String(inputs.grossMargin ?? '').trim();

  const payRoiInput = Number(roiText);
  const booth = Number(boothText);
  const ratePct = Number(rateText);
  const rate = ratePct / 100;
  const isReturnBlank = returnText === '';
  const returnRate = isReturnBlank ? 0 : Number(returnText) / 100;
  const targetType = inputs.targetType;
  const isFeeTarget = targetType === 'fee_gmv' || targetType === 'fee_gsv';
  const grossMargin = grossMarginText !== '' && Number.isFinite(Number(grossMarginText)) 
    ? Number(grossMarginText) / 100 
    : 0.50; // 默认 50% 毛利用于保本分析参考

  const defaultEmptyResult = (error: string): CalculationResult => ({
    isValid: false,
    errorMessage: error,
    params: {
      payRoi: payRoiInput || 0,
      booth: booth || 0,
      commissionRate: rate || 0,
      returnRate: returnRate || 0,
      isReturnBlank,
      targetType,
      targetValue: Number(targetText) || 0,
      grossMargin,
    },
    gmv: 0,
    gsv: 0,
    refundAmount: 0,
    commission: 0,
    talentIncome: 0,
    adSpend: 0,
    totalCost: 0,
    feeRatio: 0,
    settleFeeRatio: 0,
    adFeeRatio: 0,
    talentFeeRatio: 0,
    paymentRoi: 0,
    netRoi: 0,
    fullCostRoi: 0,
    gsvCostRoi: 0,
  });

  // 基础校验
  if (!roiText || !boothText || !rateText || !targetText) {
    return defaultEmptyResult('请完整填写支付 ROI、达人坑位费、佣金比例和所选目标值。');
  }

  if (!Number.isFinite(payRoiInput) || payRoiInput <= 0) {
    return defaultEmptyResult('支付 ROI 必须大于 0。');
  }
  if (!Number.isFinite(booth) || booth < 0) {
    return defaultEmptyResult('达人坑位费不能为负数。');
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    return defaultEmptyResult('达人佣金比例须在 0% 至 100% 之间。');
  }
  if (grossMarginText !== '' && (!Number.isFinite(Number(grossMarginText)) || Number(grossMarginText) < 0 || Number(grossMarginText) > 100)) {
    return defaultEmptyResult('产品毛利率须在 0% 至 100% 之间。');
  }
  if (!isReturnBlank && (!Number.isFinite(returnRate) || returnRate < 0 || returnRate >= 1)) {
    return defaultEmptyResult('退货率须在 0%（含）至 100%（不含）之间，或留空。');
  }

  const targetValue = Number(targetText);
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    return defaultEmptyResult(isFeeTarget ? '目标费比必须大于 0。' : '目标成交金额必须大于 0。');
  }

  let gmv = 0;
  let gsv = 0;

  if (targetType === 'fee_gmv') {
    if (booth <= 0) {
      return defaultEmptyResult('按费比反推需要大于 0 的坑位费，才能反推出正数 GMV。');
    }
    const d = targetValue / 100 - rate * (1 - returnRate) - 1 / payRoiInput;
    if (d <= 0) {
      const minRequired = (rate * (1 - returnRate) + 1 / payRoiInput) * 100;
      return defaultEmptyResult(
        `目标综合费比过低！须大于佣金与投流底线成本（${minRequired.toFixed(2)}%），才能反推出正数 GMV。`
      );
    }
    gmv = booth / d;
    gsv = gmv * (1 - returnRate);
  } else if (targetType === 'fee_gsv') {
    if (booth <= 0) {
      return defaultEmptyResult('按费比反推需要大于 0 的坑位费，才能反推出正数 GMV。');
    }
    const d = (targetValue / 100 - rate) * (1 - returnRate) - 1 / payRoiInput;
    if (d <= 0) {
      const minFee = (rate + 1 / (payRoiInput * (1 - returnRate))) * 100;
      return defaultEmptyResult(
        `目标结算费比过低！须大于结算佣金与投流成本（${minFee.toFixed(2)}%），才能反推出正数 GMV。`
      );
    }
    gmv = booth / d;
    gsv = gmv * (1 - returnRate);
  } else if (targetType === 'gmv') {
    gmv = targetValue;
    gsv = gmv * (1 - returnRate);
  } else {
    // targetType === 'gsv'
    gsv = targetValue;
    gmv = gsv / (1 - returnRate);
  }

  // 营销成本计算
  const commission = gsv * rate; // GSV 口径佣金
  const talentIncome = booth + commission;
  const adSpend = gmv / payRoiInput;
  const totalCost = talentIncome + adSpend;

  // 费比指标
  const feeRatio = totalCost / gmv;
  const settleFeeRatio = gsv > 0 ? totalCost / gsv : 0;
  const adFeeRatio = adSpend / gmv;
  const talentFeeRatio = talentIncome / gmv;

  // ROI 指标
  const paymentRoi = payRoiInput;
  const netRoi = paymentRoi * (1 - returnRate);
  const fullCostRoi = totalCost > 0 ? gmv / totalCost : 0;
  const gsvCostRoi = totalCost > 0 ? gsv / totalCost : 0;

  // 隐藏逻辑（退款率为空时）
  const isGmvHidden = isReturnBlank && targetType === 'gsv';
  const isGsvHidden = isReturnBlank && targetType !== 'gsv';
  const isNetRoiHidden = isReturnBlank;

  let warningMessage: string | undefined;
  let infoMessage: string | undefined;

  if (isReturnBlank) {
    warningMessage =
      targetType === 'gsv'
        ? '已固定目标 GSV，退货率暂按 0% 估算；已隐藏反推 GMV 与净成交 ROI。'
        : targetType === 'gmv'
        ? '已固定目标 GMV，退货率暂按 0% 估算；已隐藏 GSV 与净成交 ROI。'
        : targetType === 'fee_gsv'
        ? '退货率暂按 0% 估算并固定结算综合费比；已隐藏 GSV 与净成交 ROI。'
        : '退货率暂按 0% 估算并固定目标综合费比；已隐藏 GSV 与净成交 ROI。';
  } else if (targetType === 'fee_gmv') {
    infoMessage = '固定 GMV 口径目标综合费比：修改退货率会重新反推 GMV，以维持目标费比；GSV、佣金及总费用随之联动。';
  } else if (targetType === 'fee_gsv') {
    infoMessage = '固定 GSV 口径结算综合费比：修改退货率会重新反推 GMV，以维持结算费比；GSV、佣金及总费用随之联动。';
  } else if (targetType === 'gsv') {
    infoMessage = '固定目标 GSV：修改退货率会反推改变 GMV，并影响佣金、千川消耗和总营销费用。';
  } else {
    infoMessage = '固定目标 GMV：修改退货率会改变 GSV、佣金、千川消耗和总营销费用。';
  }

  // 经营保本分析（基于毛利率）
  // 毛利 = GSV * grossMargin. 营销费用 = totalCost.
  // 营销后预估利润 = GSV * grossMargin - totalCost.
  const estimatedGrossProfit = gsv * grossMargin;
  const estimatedNetProfit = estimatedGrossProfit - totalCost;
  const estimatedNetProfitMargin = gsv > 0 ? estimatedNetProfit / gsv : 0;

  // 达到保本所需条件：营销总费用 <= 毛利
  // 即 结算费比 <= grossMargin，全成本 ROI (GSV/Cost) >= 1 / grossMargin
  const breakevenFullRoi = grossMargin > 0 ? 1 / grossMargin : 0;
  // 保本支付 ROI:
  // 当 totalCost = gsv * grossMargin
  // booth + gsv*rate + gmv / payRoi = gsv * grossMargin
  // gmv / payRoi = gsv * (grossMargin - rate) - booth
  // payRoi = gmv / [ gsv * (grossMargin - rate) - booth ]
  const denominator = gsv * (grossMargin - rate) - booth;
  const breakevenPayRoi = denominator > 0 ? gmv / denominator : undefined;

  return {
    isValid: true,
    warningMessage,
    infoMessage,
    params: {
      payRoi: payRoiInput,
      booth,
      commissionRate: rate,
      returnRate,
      isReturnBlank,
      targetType,
      targetValue,
      grossMargin,
    },
    gmv,
    gsv,
    refundAmount: Math.max(0, gmv - gsv),
    isGmvHidden,
    isGsvHidden,
    commission,
    talentIncome,
    adSpend,
    totalCost,
    feeRatio,
    settleFeeRatio,
    adFeeRatio,
    talentFeeRatio,
    paymentRoi,
    netRoi,
    isNetRoiHidden,
    fullCostRoi,
    gsvCostRoi,
    breakevenPayRoi,
    breakevenFullRoi,
    estimatedGrossProfit,
    estimatedNetProfit,
    estimatedNetProfitMargin,
  };
}

/**
 * Generate Sensitivity Matrix for varying Return Rates and Payment ROIs
 */
export interface SensitivityPoint {
  returnRate: number;
  payRoi: number;
  feeRatio: number;
  settleFeeRatio: number;
  netRoi: number;
  totalCost: number;
  isCurrent: boolean;
}

export function generateSensitivityMatrix(
  baseInputs: CalculatorInputs,
  returnRateSteps = [0.10, 0.20, 0.30, 0.40, 0.50],
  roiSteps = [2.0, 2.5, 3.0, 3.5, 4.0]
): {
  returnRates: number[];
  roiSteps: number[];
  grid: SensitivityPoint[][];
} {
  const currentRet = baseInputs.ret === '' ? 0 : Number(baseInputs.ret) / 100;
  const currentRoi = Number(baseInputs.payRoi) || 3.0;

  const grid: SensitivityPoint[][] = [];

  for (const ret of returnRateSteps) {
    const row: SensitivityPoint[] = [];
    for (const roi of roiSteps) {
      const inputs: CalculatorInputs = {
        ...baseInputs,
        ret: (ret * 100).toString(),
        payRoi: roi.toString(),
      };
      const res = calculateCommercialMetrics(inputs);
      const isCurrent = Math.abs(currentRet - ret) < 0.01 && Math.abs(currentRoi - roi) < 0.05;

      row.push({
        returnRate: ret,
        payRoi: roi,
        feeRatio: res.isValid ? res.feeRatio : 0,
        settleFeeRatio: res.isValid ? res.settleFeeRatio : 0,
        netRoi: res.isValid ? res.netRoi : 0,
        totalCost: res.isValid ? res.totalCost : 0,
        isCurrent,
      });
    }
    grid.push(row);
  }

  return {
    returnRates: returnRateSteps,
    roiSteps,
    grid,
  };
}

