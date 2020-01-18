/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

// flowlint ambiguous-object-type:error

'use strict';

const areEqual = require('areEqual');
const deepFreeze = require('../util/deepFreeze');
const invariant = require('invariant');
const warning = require('warning');

const {isClientID} = require('./ClientID');
const {
  ID_KEY,
  REF_KEY,
  REFS_KEY,
  TYPENAME_KEY,
  INVALIDATED_AT_KEY,
} = require('./RelayStoreUtils');
import type {RelayModernRecordType} from './RelayStoreTypes';
const RelayModernRecordObjImpl = require('./RelayModernRecordObjImpl');
const RelayModernRecordMapImpl = require('./RelayModernRecordMapImpl');
const {ReasonRecordDict} = require('./Record.bs');

module.exports = false
  ? true
    ? RelayModernRecordObjImpl
    : RelayModernRecordMapImpl
  : ReasonRecordDict;
