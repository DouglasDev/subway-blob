import { styled } from '@linaria/react';

export const Shell = styled.main`
  width: min(1440px, 100%);
  margin: 0 auto;
  padding: 27px clamp(16px, 4.6vw, 72px) 22px;
`;

export const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 21px;
`;

export const Brand = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

export const Bullet = styled.span`
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 2.35rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #e54939;
  color: #fff6e7;
  font-weight: 790;
  font-size: 1.55rem;
  line-height: 1;
`;

export const Title = styled.h1`
  font-size: clamp(1.35rem, 2.65vw, 2.15rem);
  font-weight: 740;
  letter-spacing: -0.055em;
  line-height: 1.05;
  margin: 0;
`;

export const Line = styled.div`
  margin-top: 4px;
  font: 0.68rem var(--mono);
  color: #aeb9ac;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

export const Best = styled.div`
  display: grid;
  justify-items: end;
  gap: 4px;
  white-space: nowrap;
  font-family: var(--mono);
  color: #aeb9ac;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

export const BestValue = styled.strong`
  color: #e9ead8;
  font-size: 0.96rem;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
`;

export const Game = styled.section`
  overflow: hidden;
  border: 1px solid #3b4b44;
  border-radius: 13px;
  background: #182320;
  box-shadow: 0 20px 55px #0b16148c;
`;

export const Route = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  padding: 11px 22px 13px;
  background: #21312b;
  border-bottom: 1px solid #405049;

  @media (max-width: 600px) {
    gap: 4px;
    padding-inline: 11px;
  }
`;

export const Stop = styled.div`
  min-width: 0;
  display: grid;
  gap: 4px;
  color: #bac6b8;
  font-size: clamp(0.73rem, 1.3vw, 0.91rem);
  text-align: center;

  &[data-current='true'] {
    color: #f1f0db;
    font-weight: 700;
  }
`;

export const RouteLabel = styled.span`
  color: #aebcb0;
  font: 0.64rem var(--mono);
  letter-spacing: 0.07em;
  text-transform: uppercase;
`;

export const RouteDot = styled.span`
  height: 13px;
  position: relative;
  display: grid;
  place-items: center;

  &::before {
    position: absolute;
    content: '';
    height: 2px;
    background: #a45042;
    inset-inline: -6px;
    top: calc(50% - 1px);
  }

  &::after {
    position: relative;
    content: '';
    height: 7px;
    width: 7px;
    border: 2px solid #d98168;
    border-radius: 50%;
    background: #21312b;
  }

  &[data-current='true']::after {
    width: 9px;
    height: 9px;
    background: #f57b60;
    border-color: #ffad8e;
    box-shadow: 0 0 0 3px #21312b;
  }
`;

export const Stage = styled.div`
  position: relative;
  background: #233335;
  height: clamp(430px, calc(100svh - 248px), 740px);
  overflow: hidden;

  @media (max-width: 650px) {
    height: clamp(370px, calc(100svh - 255px), 620px);
  }
`;

export const View = styled.canvas`
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
`;

export const Status = styled.div`
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #152420e8;
  border: 1px solid #687d6e;
  border-radius: 4px;
  padding: 7px 10px;
  font: 0.67rem var(--mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #eeead3;

  &::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #bee572;
    box-shadow: 0 0 7px #b6e55c9a;
  }

  &[data-doors='true']::before {
    background: #ffc779;
    box-shadow: 0 0 7px #ffc779ad;
  }
`;

export const Flow = styled.div`
  position: absolute;
  top: 16px;
  right: 16px;
  background: #152420e8;
  border: 1px solid #687d6e;
  border-radius: 4px;
  padding: 7px 10px;
  font: 0.67rem var(--mono);
  color: #eeead3;
`;

export const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: end;
  justify-content: center;
  pointer-events: none;
  padding: 18px;
  background: linear-gradient(0deg, #101a16c7 0%, transparent 50%);
`;

export const Card = styled.div`
  pointer-events: auto;
  background: #182620f2;
  width: min(100%, 460px);
  border: 1px solid #77856e;
  border-radius: 8px;
  color: #f1efdb;
  padding: 16px 17px 16px 19px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  box-shadow: 0 10px 28px #10161379;

  @media (max-width: 440px) {
    padding: 12px;
    gap: 9px;
  }
`;

export const Prompt = styled.div`
  display: grid;
  gap: 4px;
  color: #c9d1be;
  font-size: 0.81rem;
  line-height: 1.4;
`;

export const PromptTitle = styled.strong`
  color: #f2efde;
  font-size: 1.11rem;
  letter-spacing: -0.025em;
  line-height: 1.2;
`;

export const Button = styled.button`
  border: 1px solid #d2ed9c;
  border-radius: 4px;
  background: #c2e984;
  color: #20311f;
  padding: 10px 13px;
  min-height: 42px;
  flex: none;
  font: 700 0.85rem var(--sans);
  cursor: pointer;

  &:hover {
    background: #def3b3;
  }
`;

export const Dashboard = styled.div`
  display: grid;
  grid-template-columns: auto auto minmax(125px, 1fr) auto;
  align-items: center;
  background: #202e27;
  border-top: 1px solid #4a5a4d;

  @media (max-width: 730px) {
    grid-template-columns: 1fr 1fr minmax(100px, 1.35fr);
  }
`;

export const Metric = styled.div`
  display: grid;
  gap: 4px;
  min-width: 116px;
  padding: 11px 16px;
  border-right: 1px solid #3f5045;

  @media (max-width: 730px) {
    min-width: 0;
    padding-inline: 10px;
  }
`;

export const MetricName = styled.span`
  color: #b8c4b6;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font: 0.64rem var(--mono);
  white-space: nowrap;
`;

export const MetricValue = styled.strong`
  color: #f4efd9;
  font: 650 1.14rem var(--mono);
  line-height: 1.08;
`;

export const Gauge = styled.div`
  padding: 11px 16px;
  min-width: 0;

  @media (max-width: 730px) {
    padding-inline: 10px;
  }
`;

export const GaugeCaption = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 4px;
  margin-bottom: 5px;
`;

export const GaugeValue = styled.span`
  color: #dce9c1;
  font: 0.64rem var(--mono);
`;

export const GaugeBar = styled.progress`
  display: block;
  width: 100%;
  height: 8px;
  appearance: none;
  border: 0;
  border-radius: 2px;
  overflow: hidden;
  background: #3a4a40;
  color: #b4dc72;

  &::-webkit-progress-bar {
    background: #3a4a40;
  }

  &::-webkit-progress-value {
    background: #b4dc72;
  }

  &[data-high='true']::-webkit-progress-value {
    background: #f4ab69;
  }

  &::-moz-progress-bar {
    background: currentColor;
  }

  &[data-high='true'] {
    color: #f4ab69;
  }
`;

export const Controls = styled.div`
  padding: 9px 15px;
  border-left: 1px solid #3f5045;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #d4ddcb;
  font-size: 0.75rem;

  @media (max-width: 730px), (pointer: coarse) {
    display: none;
  }
`;

export const Keys = styled.kbd`
  padding: 4px 5px;
  color: #f1efdb;
  border: 1px solid #617064;
  border-radius: 3px;
  font: 0.68rem var(--mono);
`;

export const Pad = styled.div`
  display: none;
  position: absolute;
  bottom: 12px;
  left: 12px;
  grid-template-columns: repeat(3, 39px);
  grid-template-rows: repeat(2, 39px);
  gap: 4px;

  @media (pointer: coarse), (max-width: 730px) {
    display: grid;
  }
`;

export const PadButton = styled.button`
  border: 1px solid #789182;
  background: #192922e8;
  border-radius: 4px;
  color: #f1f2df;
  font-size: 1.1rem;
  touch-action: none;
  user-select: none;

  &[data-dir='up'] {
    grid-column: 2;
  }

  &[data-dir='left'] {
    grid-row: 2;
    grid-column: 1;
  }

  &[data-dir='down'] {
    grid-row: 2;
    grid-column: 2;
  }

  &[data-dir='right'] {
    grid-row: 2;
    grid-column: 3;
  }

  &:active {
    background: #526649;
  }
`;
