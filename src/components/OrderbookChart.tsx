import React, { useEffect, useRef } from "react";
import styled from "styled-components";

import * as am4core from "@amcharts/amcharts4/core";
import * as am4charts from "@amcharts/amcharts4/charts";
import am4themesSpiritedaway from "@amcharts/amcharts4/themes/spiritedaway";

import { Token } from "@uniswap/sdk";

export interface OrderBookChartProps {
  /**
   * Base Token for Y-axis
   */
  baseToken: Token;
  /**
   * Quote Token for X-axis
   */
  quoteToken: Token;
  /**
   * current network id
   */
  networkId: number;
  /**
   * price/volume data with asks and bids
   */
  data: PricePointDetails[] | null;
}

const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  min-height: calc(60vh - 30rem);
  text-align: center;
  width: 100%;
  height: 100%;
  min-width: 100%;
  padding: 16px;
  box-sizing: border-box;

  .amcharts-Sprite-group {
    font-size: 1rem;
  }

  .amcharts-Container .amcharts-Label {
    text-transform: uppercase;
    font-size: 1.2rem;
  }

  .amcharts-ZoomOutButton-group > .amcharts-RoundedRectangle-group {
    fill: var(--color-text-active);
    opacity: 0.6;
    transition: 0.3s ease-in-out;

    &:hover {
      opacity: 1;
    }
  }

  .amcharts-AxisLabel,
  .amcharts-CategoryAxis .amcharts-Label-group > .amcharts-Label,
  .amcharts-ValueAxis-group .amcharts-Label-group > .amcharts-Label {
    fill: var(--color-text-primary);
  }
`;

interface OrderBookErrorProps {
  error: Error;
}

export const OrderBookError: React.FC<OrderBookErrorProps> = ({
  error,
}: OrderBookErrorProps) => (
  <Wrapper>{error ? error.message : "loading"}</Wrapper>
);

export enum Offer {
  Bid,
  Ask,
}

/**
 * Price point data represented in the graph. Contains BigNumbers for operate with less errors and more precission
 * but for representation uses number as expected by the library
 */
export interface PricePointDetails {
  // Basic data
  type: Offer;
  volume: number; // volume for the price point
  totalVolume: number; // cumulative volume
  price: number;

  // Data for representation
  priceNumber: number;
  priceFormatted: string;
  totalVolumeNumber: number;
  totalVolumeFormatted: string;
  askValueY: number | null;
  bidValueY: number | null;
  newOrderValueY: number | null;
  clearingPriceValueY: number | null;
}

export const createChart = (chartElement: HTMLElement): am4charts.XYChart => {
  am4core.useTheme(am4themesSpiritedaway);
  am4core.options.autoSetClassName = true;
  const chart = am4core.create(chartElement, am4charts.XYChart);
  chart.paddingTop = 0;
  chart.marginTop = 0;
  chart.paddingBottom = 0;
  chart.paddingLeft = 0;
  chart.paddingRight = 0;
  chart.marginBottom = 0;

  // Colors
  const colors = {
    green: "#28a745",
    red: "#dc3545",
    white: "#FFFFFF",
    grey: "#565A69",
    orange: "#FF6347",
  };

  // Create axes
  const priceAxis = chart.xAxes.push(new am4charts.ValueAxis());
  const volumeAxis = chart.yAxes.push(new am4charts.ValueAxis());
  priceAxis.renderer.labels.template.disabled = true;
  volumeAxis.renderer.labels.template.disabled = true;
  priceAxis.renderer.grid.template.disabled = true;
  volumeAxis.renderer.tooltip.getFillFromObject = false;
  priceAxis.renderer.tooltip.getFillFromObject = false;

  volumeAxis.renderer.grid.template.disabled = true;
  priceAxis.renderer.minGridDistance = 10;
  volumeAxis.renderer.minGridDistance = 10;
  // Create series
  const bidSeries = chart.series.push(new am4charts.StepLineSeries());
  bidSeries.dataFields.valueX = "priceNumber";
  bidSeries.dataFields.valueY = "bidValueY";
  bidSeries.strokeWidth = 2;
  bidSeries.stroke = am4core.color(colors.green);
  bidSeries.fill = bidSeries.stroke;
  bidSeries.fillOpacity = 0.2;

  const askSeries = chart.series.push(new am4charts.LineSeries());
  askSeries.dataFields.valueX = "priceNumber";
  askSeries.dataFields.valueY = "askValueY";
  askSeries.strokeWidth = 2;
  askSeries.stroke = am4core.color(colors.red);
  askSeries.fill = askSeries.stroke;
  askSeries.fillOpacity = 0.1;

  const inputSeries = chart.series.push(new am4charts.LineSeries());
  inputSeries.dataFields.valueX = "priceNumber";
  inputSeries.dataFields.valueY = "newOrderValueY";
  inputSeries.strokeWidth = 4;
  inputSeries.stroke = am4core.color(colors.orange);
  inputSeries.fill = inputSeries.stroke;
  inputSeries.fillOpacity = 0.1;

  const priceSeries = chart.series.push(new am4charts.LineSeries());
  priceSeries.dataFields.valueX = "priceNumber";
  priceSeries.dataFields.valueY = "clearingPriceValueY";
  priceSeries.strokeWidth = 2;
  priceSeries.strokeDasharray = "3,3";
  priceSeries.stroke = am4core.color(colors.white);
  priceSeries.fill = inputSeries.stroke;
  priceSeries.fillOpacity = 0.1;

  // Add cursor
  chart.cursor = new am4charts.XYCursor();
  chart.cursor.lineX.stroke = am4core.color("white");
  chart.cursor.lineX.strokeWidth = 1;
  chart.cursor.lineX.strokeOpacity = 0.6;
  chart.cursor.lineX.strokeDasharray = "4";

  chart.cursor.lineY.stroke = am4core.color("white");
  chart.cursor.lineY.strokeWidth = 1;
  chart.cursor.lineY.strokeOpacity = 0.6;
  chart.cursor.lineY.strokeDasharray = "4";

  // Add default empty data array
  chart.data = [];

  return chart;
};

export interface DrawLabelsParams {
  chart: am4charts.XYChart;
  baseToken: Token;
  quoteToken: Token;
  networkId: number;
}

export const drawLabels = ({
  chart,
  baseToken,
  quoteToken,
}: DrawLabelsParams): void => {
  const baseTokenLabel = baseToken.symbol;
  const quoteTokenLabel = quoteToken.symbol;
  const market = baseTokenLabel + "-" + quoteTokenLabel;

  const [xAxis] = chart.xAxes;
  const [yAxis] = chart.yAxes;

  xAxis.title.text = ` Price (${baseTokenLabel})`;
  yAxis.title.text = ` Volume (${quoteTokenLabel})`;

  xAxis.tooltip.background.cornerRadius = 0;
  xAxis.tooltip.background.fill = am4core.color("green");
  yAxis.tooltip.background.cornerRadius = 0;
  yAxis.tooltip.background.fill = am4core.color("red");

  xAxis.title.fill = am4core.color("white");
  yAxis.title.fill = am4core.color("white");

  const [bidSeries, askSeries] = chart.series;

  bidSeries.tooltipText = `[bold]${market}[/]\nBid Price: [bold]{priceFormatted}[/] ${quoteTokenLabel}\nVolume: [bold]{totalVolumeFormatted}[/] ${baseTokenLabel}`;
  askSeries.tooltipText = `[bold]${market}[/]\nAsk Price: [bold]{priceFormatted}[/] ${quoteTokenLabel}\nVolume: [bold]{totalVolumeFormatted}[/] ${baseTokenLabel}`;
};

const OrderBookChart: React.FC<OrderBookChartProps> = (
  props: OrderBookChartProps,
) => {
  const { baseToken, quoteToken, networkId, data } = props;
  const mountPoint = useRef<HTMLDivElement>(null);
  const chartRef = useRef<am4charts.XYChart | null>(null);

  useEffect(() => {
    if (!mountPoint.current) return;
    const chart = createChart(mountPoint.current);
    chartRef.current = chart;

    // dispose on mount only
    return (): void => chart.dispose();
  }, []);

  useEffect(() => {
    if (!chartRef.current || data === null) return;

    if (data.length === 0) {
      chartRef.current.data = [];
      return;
    }

    // go on with the update when data is ready
    drawLabels({
      chart: chartRef.current,
      baseToken,
      quoteToken,
      networkId,
    });

    chartRef.current.data = data;
  }, [baseToken, networkId, quoteToken, data]);

  return <Wrapper ref={mountPoint}>Show order book for auction</Wrapper>;
};

export default OrderBookChart;
