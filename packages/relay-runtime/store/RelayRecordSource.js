/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

// flowlint ambiguous-object-type:error

'use strict';

const RelayRecordSourceMapImpl = require('./RelayRecordSourceMapImpl');
const RelayModernRecord = require('./RelayModernRecord');

import type {
  MutableRecordSource,
  RecordMap,
  RecordObj,
} from './RelayStoreTypes';

class RelayRecordSource {
  constructor(records?: RecordMap): MutableRecordSource {
    return RelayRecordSource.create(records);
  }

  static create(records?: RecordMap): MutableRecordSource {
    return new RelayRecordSourceMapImpl(records);
  }

  static fromJSON(records: {
    [dataId: string]: ?RecordObj,
    ...,
  }): MutableRecordSource {
    const obj: RecordMap = {};
    for (const key in records) {
      const value = records[key];
      obj[key] = value ? RelayModernRecord.fromObj(value) : value;
    }
    return new RelayRecordSourceMapImpl(obj);
  }
}

module.exports = RelayRecordSource;
