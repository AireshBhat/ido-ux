import { JSBI, TokenAmount, WETH } from "@uniswap/sdk";
import React, { useContext, useState } from "react";
import ReactGA from "react-ga";
import { RouteComponentProps } from "react-router-dom";
import { Text } from "rebass";
import { ThemeContext } from "styled-components";
import { ButtonError, ButtonLight } from "../../components/Button";
import Card, { GreyCard } from "../../components/Card";
import { AutoColumn } from "../../components/Column";
import ConfirmationModal from "../../components/ConfirmationModal";
import CurrencyInputPanel from "../../components/CurrencyInputPanel";
import PriceInputPanel from "../../components/PriceInputPanel";
import QuestionHelper from "../../components/QuestionHelper";
import { RowBetween, RowFixed } from "../../components/Row";
import AdvancedSwapDetailsDropdown from "../../components/swap/AdvancedSwapDetailsDropdown";
import FormattedPriceImpact from "../../components/swap/FormattedPriceImpact";
import { BottomGrouping, Dots, Wrapper } from "../../components/swap/styleds";
import SwapModalFooter from "../../components/swap/SwapModalFooter";
import SwapModalHeader from "../../components/swap/SwapModalHeader";
import TradePrice from "../../components/swap/TradePrice";
import { TokenWarningCards } from "../../components/TokenWarningCard";
import {
  DEFAULT_DEADLINE_FROM_NOW,
  INITIAL_ALLOWED_SLIPPAGE,
  MIN_ETH,
} from "../../constants";
import { useActiveWeb3React } from "../../hooks";
import {
  useApproveCallbackFromTrade,
  ApprovalState,
} from "../../hooks/useApproveCallback";
import { useSwapCallback } from "../../hooks/useSwapCallback";
import { useWalletModalToggle } from "../../state/application/hooks";
import { Field } from "../../state/swap/actions";
import {
  useDefaultsFromURLSearch,
  useDerivedSwapInfo,
  useSwapActionHandlers,
  useSwapState,
} from "../../state/swap/hooks";
import { TYPE } from "../../theme";
import {
  computeTradePriceBreakdown,
  warningSeverity,
} from "../../utils/prices";
import AppBody from "../AppBody";
import OrderBody from "../OrderBody";
import { PriceSlippageWarningCard } from "../../components/swap/PriceSlippageWarningCard";
import AuctionDetails from "../../components/AuctionDetails";
import AuctionHeader from "../../components/AuctionHeader";

export default function Swap({ location: { search } }: RouteComponentProps) {
  useDefaultsFromURLSearch(search);

  const { chainId, account } = useActiveWeb3React();
  const theme = useContext(ThemeContext);

  // toggle wallet when disconnected
  const toggleWalletModal = useWalletModalToggle();

  // swap state
  const { auctionId, independentField, buyAmount, price } = useSwapState();
  const {
    bestTrade,
    tokenBalances,
    parsedAmounts,
    tokens,
    error,
    sellToken,
    buyToken,
    auctionEndDate,
    sellOrder,
  } = useDerivedSwapInfo(auctionId);
  const { onUserBuyAmountInput } = useSwapActionHandlers();
  const { onUserPriceInput } = useSwapActionHandlers();

  const isValid = !error;
  const dependentField: Field =
    independentField === Field.INPUT ? Field.OUTPUT : Field.INPUT;

  // modal and loading
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [attemptingTxn, setAttemptingTxn] = useState<boolean>(false); // clicked confirmed
  const [pendingConfirmation, setPendingConfirmation] = useState<boolean>(true); // waiting for user confirmation

  // txn values
  const [txHash, setTxHash] = useState<string>("");
  const [deadline, setDeadline] = useState<number>(DEFAULT_DEADLINE_FROM_NOW);
  const [allowedSlippage, setAllowedSlippage] = useState<number>(
    INITIAL_ALLOWED_SLIPPAGE,
  );

  const formattedAmounts = {
    [independentField]: buyAmount,
    [dependentField]: parsedAmounts[dependentField]
      ? parsedAmounts[dependentField].toSignificant(6)
      : "",
  };

  const route = bestTrade?.route;
  const userHasSpecifiedInputOutput =
    !!tokens[Field.INPUT] &&
    !!tokens[Field.OUTPUT] &&
    !!parsedAmounts[independentField] &&
    parsedAmounts[independentField].greaterThan(JSBI.BigInt(0));
  const noRoute = !route;

  // check whether the user has approved the router on the input token
  const [approval, approveCallback] = useApproveCallbackFromTrade(
    bestTrade,
    allowedSlippage,
  );

  const maxAmountInput: TokenAmount =
    !!tokenBalances[Field.INPUT] &&
    !!tokens[Field.INPUT] &&
    !!WETH[chainId] &&
    tokenBalances[Field.INPUT].greaterThan(
      new TokenAmount(
        tokens[Field.INPUT],
        tokens[Field.INPUT].equals(WETH[chainId]) ? MIN_ETH : "0",
      ),
    )
      ? tokens[Field.INPUT].equals(WETH[chainId])
        ? tokenBalances[Field.INPUT].subtract(
            new TokenAmount(WETH[chainId], MIN_ETH),
          )
        : tokenBalances[Field.INPUT]
      : undefined;
  const atMaxAmountInput: boolean =
    maxAmountInput && parsedAmounts[Field.INPUT]
      ? maxAmountInput.equalTo(parsedAmounts[Field.INPUT])
      : undefined;

  // reset modal state when closed
  function resetModal() {
    // clear input if txn submitted
    if (!pendingConfirmation) {
      onUserBuyAmountInput("");
    }
    setPendingConfirmation(true);
    setAttemptingTxn(false);
    setShowAdvanced(false);
  }

  // the callback to execute the swap
  const swapCallback = useSwapCallback(bestTrade, allowedSlippage, deadline);

  const { priceImpactWithoutFee, realizedLPFee } = computeTradePriceBreakdown(
    bestTrade,
  );

  function onSwap() {
    setAttemptingTxn(true);
    swapCallback().then((hash) => {
      setTxHash(hash);
      setPendingConfirmation(false);

      ReactGA.event({
        category: "Swap",
        action: "Swap w/o Send",
        label: [
          bestTrade.inputAmount.token.symbol,
          bestTrade.outputAmount.token.symbol,
        ].join("/"),
      });
    });
  }

  // errors
  const [showInverted, setShowInverted] = useState<boolean>(false);

  // warnings on slippage
  const priceImpactSeverity = warningSeverity(priceImpactWithoutFee);

  function modalHeader() {
    return (
      <SwapModalHeader
        independentField={independentField}
        priceImpactSeverity={priceImpactSeverity}
        tokens={tokens}
        formattedAmounts={formattedAmounts}
      />
    );
  }

  function modalBottom() {
    return (
      <SwapModalFooter
        confirmText={"Confirm Order"}
        showInverted={showInverted}
        severity={priceImpactSeverity}
        setShowInverted={setShowInverted}
        onSwap={onSwap}
        realizedLPFee={realizedLPFee}
        parsedAmounts={parsedAmounts}
        priceImpactWithoutFee={priceImpactWithoutFee}
        trade={bestTrade}
      />
    );
  }

  // text to show while loading
  const pendingText = `Swapping ${parsedAmounts[Field.INPUT]?.toSignificant(
    6,
  )} ${tokens[Field.INPUT]?.symbol} for ${parsedAmounts[
    Field.OUTPUT
  ]?.toSignificant(6)} ${tokens[Field.OUTPUT]?.symbol}`;

  return (
    <>
      <TokenWarningCards tokens={tokens} />
      <AppBody>
        <div>
          <AuctionHeader></AuctionHeader>
        </div>
        <div style={{ width: "28%", float: "left", alignContent: "center" }}>
          <AuctionDetails></AuctionDetails>
        </div>
        <div style={{ width: "70%", float: "right", alignContent: "right" }}>
          <OrderBody>
            <Wrapper id="auction-page">
              <Wrapper id="swap-page">
                <ConfirmationModal
                  isOpen={showConfirm}
                  title="Confirm Order"
                  onDismiss={() => {
                    resetModal();
                    setShowConfirm(false);
                  }}
                  attemptingTxn={attemptingTxn}
                  pendingConfirmation={pendingConfirmation}
                  hash={txHash}
                  topContent={modalHeader}
                  bottomContent={modalBottom}
                  pendingText={pendingText}
                />
                <AutoColumn gap={"md"}>
                  <>
                    <CurrencyInputPanel
                      field={Field.INPUT}
                      label={"Amount"}
                      value={buyAmount}
                      showMaxButton={!atMaxAmountInput}
                      token={buyToken}
                      onUserBuyAmountInput={onUserBuyAmountInput}
                      onMax={() => {
                        maxAmountInput &&
                          onUserBuyAmountInput(maxAmountInput.toExact());
                      }}
                      id="swap-currency-input"
                    />

                    <PriceInputPanel
                      field={Field.OUTPUT}
                      value={price}
                      onUserPriceInput={onUserPriceInput}
                      // eslint-disable-next-line @typescript-eslint/no-empty-function
                      label={"Price"}
                      showMaxButton={false}
                      sellToken={sellToken}
                      buyToken={buyToken}
                      id="swap-currency-output"
                    />
                  </>

                  {!noRoute && (
                    <Card
                      padding={".25rem 1.25rem 0 .75rem"}
                      borderRadius={"20px"}
                    >
                      <AutoColumn gap="4px">
                        <RowBetween align="center">
                          <Text
                            fontWeight={500}
                            fontSize={14}
                            color={theme.text2}
                          >
                            Price
                          </Text>
                          <TradePrice
                            trade={bestTrade}
                            showInverted={showInverted}
                            setShowInverted={setShowInverted}
                          />
                        </RowBetween>

                        {bestTrade && priceImpactSeverity > 1 && (
                          <RowBetween>
                            <TYPE.main
                              style={{
                                justifyContent: "center",
                                alignItems: "center",
                                display: "flex",
                              }}
                              fontSize={14}
                            >
                              Price Impact
                            </TYPE.main>
                            <RowFixed>
                              <FormattedPriceImpact
                                priceImpact={priceImpactWithoutFee}
                              />
                              <QuestionHelper text="The difference between the market price and estimated price due to trade size." />
                            </RowFixed>
                          </RowBetween>
                        )}
                      </AutoColumn>
                    </Card>
                  )}
                </AutoColumn>
                <BottomGrouping>
                  {!account ? (
                    <ButtonLight onClick={toggleWalletModal}>
                      Connect Wallet
                    </ButtonLight>
                  ) : noRoute && userHasSpecifiedInputOutput ? (
                    <GreyCard style={{ textAlign: "center" }}>
                      <TYPE.main mb="4px">
                        Insufficient liquidity for this trade.
                      </TYPE.main>
                    </GreyCard>
                  ) : approval === ApprovalState.NOT_APPROVED ||
                    approval === ApprovalState.PENDING ? (
                    <ButtonLight
                      onClick={approveCallback}
                      disabled={approval === ApprovalState.PENDING}
                    >
                      {approval === ApprovalState.PENDING ? (
                        <Dots>Approving {tokens[Field.INPUT]?.symbol}</Dots>
                      ) : (
                        "Approve " + tokens[Field.INPUT]?.symbol
                      )}
                    </ButtonLight>
                  ) : (
                    <ButtonError
                      onClick={() => {
                        setShowConfirm(true);
                      }}
                      id="swap-button"
                      disabled={!isValid}
                      error={isValid}
                    >
                      <Text fontSize={20} fontWeight={500}>
                        {error ?? `Execute Order`}
                      </Text>
                    </ButtonError>
                  )}
                </BottomGrouping>
              </Wrapper>
            </Wrapper>
          </OrderBody>
        </div>
      </AppBody>

      {bestTrade && (
        <AdvancedSwapDetailsDropdown
          trade={bestTrade}
          rawSlippage={allowedSlippage}
          deadline={deadline}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          setDeadline={setDeadline}
          setRawSlippage={setAllowedSlippage}
        />
      )}

      {priceImpactWithoutFee && priceImpactSeverity > 2 && (
        <AutoColumn gap="lg" style={{ marginTop: "1rem" }}>
          <PriceSlippageWarningCard priceSlippage={priceImpactWithoutFee} />
        </AutoColumn>
      )}
    </>
  );
}
