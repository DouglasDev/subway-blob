import { styled } from '@linaria/react';

export const Shell = styled.main`
  width: min(1440px, 100%);
  margin: 0 auto;
  padding: 27px clamp(16px, 4.6vw, 72px) 22px;

  @media (max-width: 480px) {
    padding: 15px 14px 12px;
  }

  &[data-touch='true'] {
    display: flex;
    flex-direction: column;
    min-height: 100svh;
    min-height: 100dvh;
    padding: 0;
  }

  html[data-arcade='true'] & {
    width: min(100%, 336px);
    height: min(100svh, 262px);
    padding: 0;
    display: flex;
    flex-direction: column;
  }
`;

export const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 21px;

  @media (max-width: 480px) {
    gap: 8px;
    margin-bottom: 12px;
  }

  &[data-touch='true'] {
    padding: 5px 8px;
    margin: 0;
  }

  @media (orientation: landscape) and (max-height: 500px) {
    &[data-touch='true'] {
      padding-block: 2px;
    }
  }

  html[data-arcade='true'] & {
    height: 28px;
    flex: none;
    margin: 0;
    padding: 0 7px;
    gap: 5px;
  }
`;

export const Brand = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;

  @media (max-width: 480px) {
    gap: 7px;
    min-width: 0;
    flex: 1;
  }

  html[data-arcade='true'] & {
    gap: 5px;
  }
`;

export const Bullet = styled.span`
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 2.35rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #00933c;
  color: #fff6e7;
  font-weight: 790;
  font-size: 1.55rem;
  line-height: 1;

  @media (max-width: 480px) {
    width: 1.94rem;
    font-size: 1.22rem;
  }

  html[data-arcade='true'] & {
    width: 19px;
    font-size: 13px;
  }
`;

export const Title = styled.h1`
  font-size: clamp(1.35rem, 2.65vw, 2.15rem);
  font-weight: 740;
  letter-spacing: -0.055em;
  line-height: 1.05;
  margin: 0;

  @media (max-width: 480px) {
    white-space: nowrap;
    font-size: clamp(1.05rem, 4.6vw, 1.45rem);
  }

  html[data-arcade='true'] & {
    font-size: 15px;
    letter-spacing: -0.03em;
  }
`;

export const Line = styled.div`
  margin-top: 4px;
  font: 0.68rem var(--mono);
  color: #c3cad1;
  text-transform: uppercase;
  letter-spacing: 0.1em;

  @media (max-width: 480px) {
    font-size: 0.56rem;
    letter-spacing: 0.05em;
  }

  @media (orientation: landscape) and (max-height: 500px) {
    &[data-touch='true'] {
      display: none;
    }
  }

  html[data-arcade='true'] & {
    display: none;
  }
`;

export const Best = styled.div`
  display: grid;
  justify-items: end;
  gap: 4px;
  white-space: nowrap;
  font-family: var(--mono);
  color: #c3cad1;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;

  @media (max-width: 480px) {
    gap: 4px;
    font-size: 0.56rem;
    letter-spacing: 0.035em;
  }

  html[data-arcade='true'] & {
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-size: 9px;
  }
`;

export const BestValue = styled.strong`
  color: #e9ead8;
  font-size: 0.96rem;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;

  @media (max-width: 480px) {
    font-size: 0.81rem;
  }

  html[data-arcade='true'] & {
    font-size: 10px;
  }
`;

export const Game = styled.section`
  overflow: hidden;
  border: 1px solid #5a6167;
  border-radius: 13px;
  background: #111316;
  box-shadow: 0 20px 55px #0b16148c;

  &[data-touch='true'] {
    display: flex;
    flex: 1;
    flex-direction: column;
    border: 0;
    border-radius: 0;
  }

  html[data-arcade='true'] & {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    border-radius: 0;
    box-shadow: none;
  }
`;

export const Route = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  padding: 11px 22px 13px;
  background: #15171a;
  border-bottom: 1px solid #545a60;

  @media (max-width: 600px) {
    gap: 4px;
    padding-inline: 11px;
  }

  @media (orientation: landscape) and (max-height: 500px) {
    &[data-touch='true'] {
      --route-dot-display: none;
      --stop-gap: 2px;
      padding-block: 3px;
    }
  }

  &[data-touch='true'] {
    --stop-name-wrap: nowrap;
    padding-block: 7px;

    @media (orientation: landscape) and (max-height: 500px) {
      padding-block: 3px;
    }
  }

  &[data-two='true'] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  html[data-arcade='true'] & {
    grid-template-columns: 1.25fr 1fr;
    flex: none;
    padding: 3px 5px 4px;
    gap: 3px;
  }
`;

export const Stop = styled.div`
  min-width: 0;
  display: grid;
  gap: var(--stop-gap, 4px);
  color: #c8cdd2;
  font-size: clamp(0.73rem, 1.3vw, 0.91rem);
  text-align: center;

  &[data-current='true'] {
    color: #ffffff;
    font-weight: 700;
  }

  html[data-arcade='true'] & {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    white-space: nowrap;
  }
`;

export const StopName = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: var(--stop-name-wrap, normal);
`;

export const RouteLabel = styled.span`
  color: #aebcb0;
  font: 0.64rem var(--mono);
  letter-spacing: 0.07em;
  text-transform: uppercase;

  html[data-arcade='true'] & {
    font-size: 8px;
    letter-spacing: 0;
  }
`;

export const RouteDot = styled.span`
  height: 13px;
  position: relative;
  display: var(--route-dot-display, grid);
  place-items: center;

  &::before {
    position: absolute;
    content: '';
    height: 2px;
    background: #508160;
    inset-inline: -6px;
    top: calc(50% - 1px);
  }

  &::after {
    position: relative;
    content: '';
    height: 7px;
    width: 7px;
    border: 2px solid #8fbd9c;
    border-radius: 50%;
    background: #15171a;
  }

  &[data-current='true']::after {
    width: 9px;
    height: 9px;
    background: #00933c;
    border-color: #a8dbac;
    box-shadow: 0 0 0 3px #15171a;
  }

  html[data-arcade='true'] & {
    display: none;
  }
`;

export const Stage = styled.div`
  position: relative;
  background: #233335;
  height: clamp(430px, calc(100svh - 296px), 740px);
  overflow: hidden;

  @media (max-width: 650px) {
    height: clamp(245px, calc(100svh - 330px), 620px);
  }

  &[data-touch='true'] {
    flex: 1;
    height: auto;
    min-height: 184px;

    @media (max-height: 650px) {
      min-height: 140px;
    }

    @media (orientation: landscape) and (max-height: 500px) {
      min-height: 102px;
    }
  }

  html[data-arcade='true'] & {
    height: auto;
    min-height: 0;
    flex: 1;
  }
`;

export const View = styled.canvas`
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
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

  html[data-arcade='true'] & {
    top: 5px;
    right: 5px;
    padding: 3px 4px;
    font-size: 9px;
  }
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

  &[data-start='true'] {
    align-items: center;
    background: #0c171580;
  }

  @media (max-width: 360px) and (max-height: 650px) {
    &[data-touch='true'] {
      padding: 8px;
    }
  }

  @media (orientation: landscape) and (max-height: 500px) {
    &[data-touch='true'] {
      padding: 8px;
    }
  }

  html[data-arcade='true'] & {
    padding: 5px;
  }
`;

export const Card = styled.div`
  pointer-events: auto;
  background: #101216f2;
  width: min(100%, 460px);
  border: 1px solid #8c969f;
  border-radius: 8px;
  color: #f1efdb;
  padding: 16px 17px 16px 19px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  box-shadow: 0 10px 28px #10161379;

  &[data-start='true'] {
    width: min(100%, 360px);
    display: grid;
    justify-content: stretch;
    border-color: #7bb994;
    box-shadow: 0 12px 32px #091913bd;
  }

  @media (max-width: 440px) {
    padding: 12px;
    gap: 9px;
  }

  @media (orientation: landscape) and (max-height: 500px) {
    &[data-touch='true'] {
      padding: 7px 11px;

      &[data-start='true'] {
        width: min(100%, 590px);
        grid-template-columns: minmax(0, 1fr) minmax(120px, 40%);
        padding-block: 4px;
        gap: 12px;
      }
    }
  }

  html[data-arcade='true'] & {
    &[data-start='true'] {
      width: min(100%, 254px);
      padding: 8px 10px;
      gap: 7px;
    }

    width: 100%;
    padding: 5px 6px;
    gap: 5px;
    border-radius: 4px;
  }
`;

export const Prompt = styled.div`
  display: grid;
  gap: 4px;
  color: #dce1e6;
  font-size: 0.81rem;
  line-height: 1.4;

  &[data-start='true'] {
    color: #e7edf0;
    font-size: 0.94rem;
    line-height: 1.3;
    text-align: center;
  }

  html[data-arcade='true'] & {
    font-size: 9px;
    gap: 2px;

    &[data-start='true'] {
      font-size: 11px;
    }
  }
`;

export const PromptTitle = styled.strong`
  color: #ffffff;
  font-size: 1.11rem;
  letter-spacing: -0.025em;
  line-height: 1.2;

  html[data-arcade='true'] & {
    font-size: 13px;
  }
`;

export const Button = styled.button`
  border: 1px solid #ffffff;
  border-radius: 4px;
  background: #e7edf6;
  color: #071933;
  padding: 10px 13px;
  min-height: 42px;
  flex: none;
  font: 700 0.85rem var(--sans);
  cursor: pointer;

  &:hover {
    background: #ffffff;
  }

  &[data-touch='true'] {
    min-height: 44px;
    padding-inline: 16px;
    border-radius: 22px;
  }

  &[data-start='true'] {
    min-height: 52px;
    background: #91efb2;
    color: #102719;
    border-color: #bdfacd;
    font-size: 1.05rem;

    &:hover {
      background: #bdffd0;
    }

    &:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 3px;
    }
  }

  html[data-arcade='true'] & {
    &[data-start='true'] {
      min-height: 32px;
      font-size: 14px;
    }

    min-height: 25px;
    padding: 4px 7px;
    font-size: 10px;
  }
`;

export const Dashboard = styled.div`
  display: grid;
  grid-template-columns: auto auto minmax(125px, 1fr) auto;
  align-items: center;
  background: #131619;
  border-top: 1px solid #4a5a4d;

  @media (max-width: 730px) {
    grid-template-columns: 1fr 1fr minmax(100px, 1.35fr);
  }

  &[data-touch='true'] {
    grid-template-columns: 1fr 1fr minmax(100px, 1.35fr);
  }

  html[data-arcade='true'] & {
    grid-template-columns: 67px 62px 1fr;
    flex: none;
  }
`;

export const Metric = styled.div`
  display: grid;
  gap: 4px;
  min-width: 116px;
  padding: 11px 16px;
  border-right: 1px solid #3e444a;

  @media (max-width: 730px) {
    min-width: 0;
    padding-inline: 10px;
  }

  @media (max-width: 360px) and (max-height: 650px) {
    &[data-touch='true'] {
      padding-block: 7px;
    }
  }

  @media (orientation: landscape) and (max-height: 500px) {
    &[data-touch='true'] {
      padding-block: 3px;
    }
  }

  html[data-arcade='true'] & {
    padding: 3px 6px;
    gap: 2px;
  }
`;

export const MetricName = styled.span`
  color: #c7cdd3;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font: 0.64rem var(--mono);
  white-space: nowrap;

  @media (max-width: 480px) {
    font-size: 0.56rem;
    line-height: 1.13;
    white-space: normal;
  }

  html[data-arcade='true'] & {
    font-size: 9px;
  }
`;

export const MetricValue = styled.strong`
  color: #f4efd9;
  font: 650 1.14rem var(--mono);
  line-height: 1.08;

  html[data-arcade='true'] & {
    font-size: 13px;
  }
`;

export const Gauge = styled.div`
  padding: 11px 16px;
  min-width: 0;

  @media (max-width: 730px) {
    padding-inline: 10px;
  }

  @media (max-width: 360px) and (max-height: 650px) {
    &[data-touch='true'] {
      padding-block: 7px;
    }
  }

  @media (orientation: landscape) and (max-height: 500px) {
    &[data-touch='true'] {
      padding-block: 3px;
    }
  }

  html[data-arcade='true'] & {
    padding: 3px 6px;
  }
`;

export const GaugeCaption = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 4px;
  margin-bottom: 5px;

  @media (max-width: 480px) {
    gap: 3px;
  }

  html[data-arcade='true'] & {
    margin-bottom: 3px;
  }
`;

export const GaugeValue = styled.span`
  color: #dce9c1;
  font: 0.64rem var(--mono);

  html[data-arcade='true'] & {
    font-size: 9px;
  }
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
    background: #f08470;
  }

  &::-moz-progress-bar {
    background: currentColor;
  }

  &[data-high='true'] {
    color: #f08470;
  }

  html[data-arcade='true'] & {
    height: 6px;
  }
`;

export const Controls = styled.div`
  padding: 9px 15px;
  border-left: 1px solid #3e444a;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #d4ddcb;
  font-size: 0.75rem;

  &[data-idle='true'] {
    opacity: 0.35;
  }

  @media (max-width: 730px) {
    grid-column: 1 / -1;
    padding-block: 4px;
    border-left: 0;
  }

  html[data-arcade='true'] & {
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

export const SoundButton = styled.button`
  min-height: 42px;
  padding: 5px 9px;
  background: #063e80;
  color: #ffffff;
  border: 1px solid #598dc9;
  border-radius: 4px;
  font: 0.69rem var(--mono);
  cursor: pointer;

  &[data-idle='true']:not(:hover, :focus-visible) {
    opacity: 0.72;
  }

  @media (max-width: 480px) {
    min-height: 38px;
    padding: 4px 6px;
    font-size: 0.63rem;
  }

  &[data-touch='true'] {
    min-width: 48px;
    min-height: 38px;
    padding-inline: 7px;
    border-radius: 6px;
  }

  html[data-arcade='true'] & {
    min-height: 19px;
    padding: 2px 4px;
    font-size: 8px;
  }
`;

export const Inventory = styled.div`
  display: flex;
  gap: 7px;
  padding: 6px 12px;
  background: #15171b;
  border-top: 1px solid #3c5246;

  &[data-idle='true'] {
    opacity: 0.38;
  }

  html[data-arcade='true'] & {
    flex: none;
    padding: 2px 4px;
    gap: 4px;
  }
`;

export const InventorySlot = styled.button`
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 4px 8px;
  background: #154f8f;
  border: 1px solid #6199da;
  border-radius: 4px;
  color: #eef1dc;
  text-align: left;
  font: 650 0.76rem var(--sans);
  cursor: pointer;
  touch-action: manipulation;

  &:disabled {
    background: #282d34;
    border-color: #4c5c53;
    color: #b3c2b4;
    cursor: default;
  }

  html[data-arcade='true'] & {
    min-height: 18px;
    padding: 1px 4px;
    font-size: 9px;
  }
`;

export const InventoryKey = styled.kbd`
  display: inline-block;
  padding: 1px 4px;
  margin-right: 4px;
  color: #f3f2d8;
  background: #0f2037;
  border-radius: 2px;
  font: 0.65rem var(--mono);

  html[data-arcade='true'] & {
    font-size: 8px;
  }
`;

export const EncounterNotice = styled.div`
  position: absolute;
  left: 16px;
  top: 15px;
  background: #493528ee;
  color: #fae7b6;
  border: 1px solid #926d4e;
  border-radius: 4px;
  padding: 6px 9px;
  font: 0.69rem var(--mono);
  pointer-events: none;

  &[data-danger='true'] {
    background: #743728f2;
    border-color: #e57d5f;
    color: #fff1c8;
  }

  html[data-arcade='true'] & {
    left: 5px;
    top: 5px;
    padding: 3px 4px;
    font-size: 8px;
  }
`;

export const Speech = styled.span`
  position: absolute;
  left: 50%;
  top: 37%;
  transform: translate(-50%, -100%);
  max-width: min(52%, 220px);
  z-index: 1;
  background: #fff1cd;
  color: #17251c;
  border-radius: 7px;
  padding: 7px 9px;
  font: 650 0.79rem / 1.25 var(--sans);
  text-align: center;
  pointer-events: none;

  &::after {
    position: absolute;
    top: 100%;
    left: 50%;
    content: '';
    border: 5px solid transparent;
    border-top-color: #fff1cd;
  }

  html[data-arcade='true'] & {
    padding: 4px 6px;
    font-size: 9px;
  }
`;

export const PowerNotice = styled.div`
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%) rotate(-3deg);
  z-index: 1;
  white-space: nowrap;
  background: #d6f96e;
  color: #18290f;
  border: 2px solid #18290f;
  border-radius: 5px;
  box-shadow: 3px 3px 0 #18290f;
  padding: 7px 12px;
  font: 800 0.86rem var(--sans);
  pointer-events: none;

  &[data-mode='crazy'] {
    background: #f1a6ff;
    color: #36173a;
  }

  &[data-mode='vomit'] {
    background: #a4eb74;
  }

  &[data-mode='cool'],
  &[data-mode='shield'] {
    background: #a8e5ff;
    color: #163b60;
  }

  html[data-arcade='true'] & {
    bottom: 7px;
    padding: 3px 6px;
    font-size: 10px;
  }
`;
