import { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { EDIT_GAS_MODES, PRIORITY_LEVELS } from '../../../shared/constants/gas';
import {
  decimalToHex,
  decGWEIToHexWEI,
} from '../../helpers/utils/conversions.util';
import {
  createCancelTransaction,
  createSpeedUpTransaction,
  updateCustomSwapsEIP1559GasParams,
  updateSwapsUserFeeLevel,
  updateTransaction as updateTransactionFn,
} from '../../store/actions';
import { useIncrementedGasFees } from '../useIncrementedGasFees';

export const useTransactionFunctions = ({
  defaultEstimateToUse,
  editGasMode,
  estimatedBaseFee,
  gasFeeEstimates,
  gasLimit: gasLimitValue,
  maxPriorityFeePerGas: maxPriorityFeePerGasValue,
  transaction,
}) => {
  const dispatch = useDispatch();

  const updateTransaction = useCallback(
    ({
      estimateUsed,
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
      txMeta,
    }) => {
      const newGasSettings = {
        gas: decimalToHex(gasLimit || gasLimitValue),
        gasLimit: decimalToHex(gasLimit || gasLimitValue),
        estimateSuggested: defaultEstimateToUse,
        estimateUsed,
      };
      if (maxFeePerGas) {
        newGasSettings.maxFeePerGas = maxFeePerGas;
      }
      if (maxPriorityFeePerGas) {
        newGasSettings.maxPriorityFeePerGas =
          maxPriorityFeePerGas || decGWEIToHexWEI(maxPriorityFeePerGasValue);
      }

      const updatedTxMeta = {
        ...transaction,
        userFeeLevel: estimateUsed || PRIORITY_LEVELS.CUSTOM,
        txParams: {
          ...transaction.txParams,
          ...newGasSettings,
        },
        ...txMeta,
      };

      if (editGasMode === EDIT_GAS_MODES.SWAPS) {
        dispatch(
          updateSwapsUserFeeLevel(estimateUsed || PRIORITY_LEVELS.CUSTOM),
        );
        dispatch(updateCustomSwapsEIP1559GasParams(newGasSettings));
      } else {
        dispatch(updateTransactionFn(updatedTxMeta));
      }
    },
    [
      defaultEstimateToUse,
      dispatch,
      editGasMode,
      gasLimitValue,
      maxPriorityFeePerGasValue,
      transaction,
    ],
  );

  // logic to run on previous value always
  const customGasSettings = useIncrementedGasFees(transaction);

  const cancelTransaction = useCallback(() => {
    dispatch(
      createCancelTransaction(transaction.id, transaction.txParams, {
        estimatedBaseFee,
      }),
    );
  }, [dispatch, estimatedBaseFee, transaction]);

  const speedupTransaction = useCallback(() => {
    dispatch(
      createSpeedUpTransaction(transaction.id, transaction.txParams, {
        estimatedBaseFee,
      }),
    );
  }, [dispatch, estimatedBaseFee, transaction]);

  const updateTransactionToMinimumGasFee = useCallback(() => {
    const {
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit,
    } = transaction?.txParams;
    const txMeta = {};
    if (!transaction.previousGas) {
      txMeta.previousGas = {
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit,
      };
    }
    updateTransaction({
      estimateUsed: PRIORITY_LEVELS.MINIMUM,
      ...transaction.txParams,
      ...customGasSettings,
      txMeta,
    });
  }, [customGasSettings, transaction, updateTransaction]);

  const updateTransactionUsingEstimate = useCallback(
    (gasFeeEstimateToUse) => {
      const {
        suggestedMaxFeePerGas,
        suggestedMaxPriorityFeePerGas,
      } = gasFeeEstimates[gasFeeEstimateToUse];
      updateTransaction({
        estimateUsed: gasFeeEstimateToUse,
        maxFeePerGas: decGWEIToHexWEI(suggestedMaxFeePerGas),
        maxPriorityFeePerGas: decGWEIToHexWEI(suggestedMaxPriorityFeePerGas),
      });
    },
    [gasFeeEstimates, updateTransaction],
  );

  const updateTransactionUsingDAPPSuggestedValues = useCallback(() => {
    const {
      maxFeePerGas,
      maxPriorityFeePerGas,
    } = transaction?.dappSuggestedGasFees;
    updateTransaction({
      estimateUsed: PRIORITY_LEVELS.DAPP_SUGGESTED,
      maxFeePerGas,
      maxPriorityFeePerGas,
    });
  }, [transaction, updateTransaction]);

  return {
    cancelTransaction,
    speedupTransaction,
    updateTransaction,
    updateTransactionToMinimumGasFee,
    updateTransactionUsingDAPPSuggestedValues,
    updateTransactionUsingEstimate,
  };
};
