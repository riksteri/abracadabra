import {
  Ability,
  ActivationCost,
  Card,
  GameState,
  GameStateActions,
  ManaPool,
  Permanent,
  Zone
} from './types';
import {
  ACTIVATE_ABILITY,
  CAST,
  MOVE_CARD_BETWEEN_ZONES,
  POP_STACK,
  TAP_PERMANENT
} from './types';
import { pipe, sum, values } from 'ramda';

const assert = (fn: (...args: any) => boolean): true => {
  if (!fn()) throw new Error('Assert error');
  return true;
};

export const getPermanent = (state: GameState, id: number): Permanent => {
  const card = state.board.find(permanentMaybe => !!permanentMaybe);
  if (card) return card;
  throw new Error(`could not find permanent with id ${id}`);
};

// @ts-ignore
const payManaCost = (
  manaPool: ManaPool,
  cost: ActivationCost
): [ManaPool, ActivationCost] => {
  const deplete = (a: number, b: number): [number, number] => [
    Math.max(0, a - b),
    Math.abs(a - b)
  ];

  const getConvertedManaValue = pipe(
    values,
    sum
  );

  const [bManaLeft, bCostLeft] = deplete(manaPool.b, cost.b);
  const [rManaLeft, rCostLeft] = deplete(manaPool.r, cost.r);
  const [gManaLeft, gCostLeft] = deplete(manaPool.g, cost.g);
  const [uManaLeft, uCostLeft] = deplete(manaPool.u, cost.u);
  const [wManaLeft, wCostLeft] = deplete(manaPool.w, cost.w);
  const [cManaLeft, cCostLeft] = deplete(manaPool.c, cost.c);

  const naiveResult: [ManaPool, ActivationCost] = [
    {
      b: bManaLeft,
      r: rManaLeft,
      g: gManaLeft,
      u: uManaLeft,
      w: wManaLeft,
      c: cManaLeft
    },
    {
      b: bCostLeft,
      r: rCostLeft,
      g: gCostLeft,
      u: uCostLeft,
      w: wCostLeft,
      c: cCostLeft,
      tapSelf: cost.tapSelf
    }
  ];
  const convertedManaLeft = getConvertedManaValue(naiveResult[0]);
  const depleteRemainingManaPool = convertedManaLeft <= cCostLeft;
  return depleteRemainingManaPool
    ? [
        ManaPool.NULL,
        {
          b: bCostLeft,
          r: rCostLeft,
          g: gCostLeft,
          u: uCostLeft,
          w: wCostLeft,
          c: cCostLeft - convertedManaLeft,
          tapSelf: cost.tapSelf
        }
      ]
    : naiveResult;
};

const payPossibleSelfTapReducer = (
  state: GameState,
  permanent: Permanent,
  ability: Ability
): GameState =>
  ability.cost.tapSelf ? tapPermanentReducer(state, permanent.id) : state;

const tapPermanentReducer = (
  state: GameState,
  permanentIdToTap: number
): GameState => ({
  ...state,
  board: state.board.map(permanent =>
    permanent.id === permanentIdToTap
      ? { ...permanent, isTapped: true }
      : permanent
  )
});

const gainPossibleManaReducer = (
  state: GameState,
  ability: Ability
): GameState =>
  Ability.isManaAbility(ability)
    ? { ...state, manaPool: ManaPool.Add(state.manaPool, ability.effect()) }
    : state;

export const moveCardBetweenZonesReducer = (
  state: GameState,
  card: Card,
  from: Zone,
  to: Zone
): GameState => {
  const thisCard = (card_: Card) => card_.id === card.id;
  const notThisCard = (card_: Card) => card_.id !== card.id;

  switch (from) {
    case null:
      break;
    case 'hand':
      assert(() => state.hand.find(thisCard) !== undefined);
      state = {
        ...state,
        hand: state.hand.filter(notThisCard)
      };
      break;
    case 'battlefield':
      assert(() => state.board.find(thisCard) !== undefined);
      state = { ...state, board: state.board.filter(notThisCard) };
      break;
    case 'stack':
      assert(() => state.stack.find(thisCard) !== undefined);
      state = { ...state, stack: state.stack.filter(notThisCard) };
      break;
    default:
      throw new Error('unsupported from-zone: ' + from);
  }

  switch (to) {
    case null:
      break;
    case 'hand':
      state = { ...state, hand: [...state.hand, card] };
      break;
    case 'battlefield':
      state = {
        ...state,
        board: [...state.board, { ...card, isTapped: false }]
      };
      break;
    case 'stack':
      state = { ...state, stack: [...state.stack, card] };
      break;
    default:
      throw new Error('unsupported to-zone: ' + to);
  }

  return state;
};

export const gameStateReducer = (
  state = GameState.NULL,
  action: GameStateActions
): GameState => {
  if (action.type.startsWith('@@')) return state;

  switch (action.type) {
    case TAP_PERMANENT: {
      return tapPermanentReducer(state, action.id);
    }

    case MOVE_CARD_BETWEEN_ZONES:
      return moveCardBetweenZonesReducer(
        state,
        action.card,
        action.from,
        action.to
      );

    case ACTIVATE_ABILITY: {
      const activatedPermanent = getPermanent(state, action.permanentId);
      const activatedAbility = activatedPermanent.abilities[action.abilityId];

      if (!activatedAbility.usesStack) {
        state = payPossibleSelfTapReducer(
          state,
          activatedPermanent,
          activatedAbility
        );
        state = gainPossibleManaReducer(state, activatedAbility);
      } else {
        throw new Error('Stack abilities not supported');
      }

      return state;
    }

    case CAST:
      return action.card.onCast(state);

    case POP_STACK: {
      const isNotLastelement = (_: unknown, i: number) =>
        i !== state.stack.length - 1;

      const poppedStackObject = state.stack[state.stack.length - 1];
      const stackWithoutPoppedObject = state.stack.filter(isNotLastelement);
      state = { ...state, stack: stackWithoutPoppedObject };
      state = poppedStackObject.onResolve(state);
      return state;
    }

    default:
      throw new Error(
        'Reducer not returning on action ' + JSON.stringify(action)
      );
  }
};
