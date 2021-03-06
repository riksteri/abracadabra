import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyMiddleware, createStore } from 'redux';
import reduxMulti from 'redux-multi';
import { moveCardsBetweenZonesAction } from '../redux/game-state/actions';
import {
  gameStateReducer,
  moveCardBetweenZonesReducer
} from '../redux/game-state/reducers';
import {
  Ability,
  Card,
  CardLifetimeEventHandler,
  CardTypeInfo,
  ManaPool
} from '../redux/game-state/types';
import Game from './Game';

const anyWindow = window as any;

const createStoreWithMiddleware = applyMiddleware(reduxMulti)(createStore);
const store = createStoreWithMiddleware(
  gameStateReducer,
  anyWindow.__REDUX_DEVTOOLS_EXTENSION__ &&
    anyWindow.__REDUX_DEVTOOLS_EXTENSION__()
);

const swamp: Card = {
  castingCost: {},
  abilities: [Ability.TapForBlackMana],
  id: 0,
  name: 'Swamp',
  typeInfo: CardTypeInfo.Swamp,
  onCast: state =>
    // todo: allow only one land per turn
    moveCardBetweenZonesReducer(state, swamp, 'hand', 'battlefield'),
  onResolve: CardLifetimeEventHandler.NULL
};

const darkRitual: Card = {
  castingCost: { b: 1 },
  abilities: [],
  onCast: state =>
    moveCardBetweenZonesReducer(state, darkRitual, 'hand', 'stack'),
  onResolve: state => ({
    ...state,
    manaPool: ManaPool.Add(state.manaPool, { b: 3 })
  }),
  id: 1,
  name: 'Dark Ritual',
  typeInfo: CardTypeInfo.Instant
};

const pyreticRitual: Card = {
  castingCost: { r: 1, c: 1 },
  abilities: [],
  onCast: state =>
    moveCardBetweenZonesReducer(state, pyreticRitual, 'hand', 'stack'),
  onResolve: state => ({
    ...state,
    manaPool: ManaPool.Add(state.manaPool, { r: 3 })
  }),
  id: 2,
  name: 'Pyretic Ritual',
  typeInfo: CardTypeInfo.Instant
};

store.dispatch([
  moveCardsBetweenZonesAction(swamp, null, 'hand'),
  moveCardsBetweenZonesAction(darkRitual, null, 'hand'),
  moveCardsBetweenZonesAction(pyreticRitual, null, 'hand')
]);

ReactDOM.render(
  <Provider store={store}>
    <Game />
  </Provider>,
  document.getElementById('example')
);
