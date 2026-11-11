import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCommercialMetrics, generateSensitivityMatrix } from './calculator';

test('Mode 1: fee_gmv - calculates GMV and fee correctly', () => {
  const result = calculateCommercialMetrics({
    payRoi: 3,
    booth: 50000,
    rate: 5,
    ret: 20,
    targetType: 'fee_gmv',
    targetValue: 60,
  });

  assert.equal(result.isValid, true);
  assert.equal(result.errorMessage, undefined);

  // d = 0.60 - 0.05*(1 - 0.20) - 1/3 = 0.60 - 0.04 - 1/3 = 0.2266666666666667
  // gmv = 50000 / d ≈ 220588.235
  assert.ok(Math.abs(result.gmv - 220588.24) < 1);
  assert.ok(Math.abs(result.gsv - result.gmv * 0.8) < 0.01);

  // 广告消耗 = gmv / 3
  assert.ok(Math.abs(result.adSpend - result.gmv / 3) < 0.01);
  // 达人佣金 = gsv * 0.05
  assert.ok(Math.abs(result.commission - result.gsv * 0.05) < 0.01);
  // 达人总收益 = 50000 + 佣金
  assert.ok(Math.abs(result.talentIncome - (50000 + result.commission)) < 0.01);

  // 综合费比 = 总营销费用 / GMV 应严格等于 60%
  assert.ok(Math.abs(result.feeRatio - 0.60) < 0.0001);
  // 全成本 ROI = 1 / 0.60 ≈ 1.67
  assert.ok(Math.abs(result.fullCostRoi - 1 / 0.60) < 0.001);
  // 支付 ROI = 3.00
  assert.equal(result.paymentRoi, 3);
  // 净成交 ROI = 3 * 0.8 = 2.40
  assert.ok(Math.abs(result.netRoi - 2.40) < 0.001);
});

test('Mode 2: fee_gsv - calculates settlement fee ratio correctly', () => {
  const result = calculateCommercialMetrics({
    payRoi: 3,
    booth: 30000,
    rate: 10,
    ret: 20,
    targetType: 'fee_gsv',
    targetValue: 65,
  });

  assert.equal(result.isValid, true);
  // 结算综合费比 = totalCost / GSV 应严格等于 65%
  assert.ok(Math.abs(result.settleFeeRatio - 0.65) < 0.0001);
});

test('Mode 3: gmv - calculates from target GMV', () => {
  const result = calculateCommercialMetrics({
    payRoi: 2.5,
    booth: 20000,
    rate: 15,
    ret: 30,
    targetType: 'gmv',
    targetValue: 200000,
  });

  assert.equal(result.isValid, true);
  assert.equal(result.gmv, 200000);
  assert.equal(result.gsv, 140000); // 200000 * (1 - 0.3)
  assert.equal(result.adSpend, 80000); // 200000 / 2.5
  assert.equal(result.commission, 21000); // 140000 * 0.15
  assert.equal(result.talentIncome, 41000); // 20000 + 21000
  assert.equal(result.totalCost, 121000); // 41000 + 80000
  assert.ok(Math.abs(result.feeRatio - 121000 / 200000) < 0.0001);
});

test('Mode 4: gsv - calculates from target GSV', () => {
  const result = calculateCommercialMetrics({
    payRoi: 4,
    booth: 10000,
    rate: 8,
    ret: 25,
    targetType: 'gsv',
    targetValue: 150000,
  });

  assert.equal(result.isValid, true);
  assert.equal(result.gsv, 150000);
  assert.equal(result.gmv, 200000); // 150000 / 0.75
  assert.equal(result.adSpend, 50000); // 200000 / 4
});

test('Edge case: Blank return rate hides GSV and Net ROI', () => {
  const result = calculateCommercialMetrics({
    payRoi: 3,
    booth: 50000,
    rate: 5,
    ret: '',
    targetType: 'fee_gmv',
    targetValue: 60,
  });

  assert.equal(result.isValid, true);
  assert.equal(result.isGsvHidden, true);
  assert.equal(result.isNetRoiHidden, true);
  assert.ok(result.warningMessage?.includes('退货率暂按 0% 估算'));
});

test('Validation: Target fee ratio too low triggers informative error', () => {
  // If target fee ratio is smaller than commission + 1/ROI, formula denominator is <= 0
  const result = calculateCommercialMetrics({
    payRoi: 2, // ad cost ratio = 50%
    booth: 50000,
    rate: 20, // 20%
    ret: 0,
    targetType: 'fee_gmv',
    targetValue: 60, // 60% < 50% + 20% = 70%
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errorMessage?.includes('目标综合费比过低'));
});

test('Sensitivity matrix generation creates correct grid dimensions', () => {
  const matrix = generateSensitivityMatrix({
    payRoi: 3,
    booth: 50000,
    rate: 5,
    ret: '20',
    targetType: 'fee_gmv',
    targetValue: 60,
  });

  assert.equal(matrix.returnRates.length, 5);
  assert.equal(matrix.roiSteps.length, 5);
  assert.equal(matrix.grid.length, 5);
  assert.equal(matrix.grid[0].length, 5);
});

