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

import type {DataID} from '../util/RelayRuntimeTypes';
import type {Record, RecordObj, RelayModernRecordType} from './RelayStoreTypes';

const __FROZEN__ = '__FROZEN__';

/**
 * @public
 *
 * Low-level record manipulation methods.
 *
 * A note about perf: we use long-hand property access rather than computed
 * properties in this file for speed ie.
 *
 *    const object = {};
 *    object[KEY] = value;
 *    record[storageKey] = object;
 *
 * instead of:
 *
 *    record[storageKey] = {
 *      [KEY]: value,
 *    };
 *
 * The latter gets transformed by Babel into something like:
 *
 *    function _defineProperty(obj, key, value) {
 *      if (key in obj) {
 *        Object.defineProperty(obj, key, {
 *          value: value,
 *          enumerable: true,
 *          configurable: true,
 *          writable: true,
 *        });
 *      } else {
 *        obj[key] = value;
 *      }
 *      return obj;
 *    }
 *
 *    record[storageKey] = _defineProperty({}, KEY, value);
 *
 * A quick benchmark shows that computed property access is an order of
 * magnitude slower (times in seconds for 100,000 iterations):
 *
 *               best     avg     sd
 *    computed 0.02175 0.02292 0.00113
 *      manual 0.00110 0.00123 0.00008
 */
opaque type RecordImpl = Map<string, mixed>;

/**
 * @public
 *
 * Clone a record.
 */
function clone(record: Record): Record {
  const r = ((record: any): RecordImpl);
  const newRecord: RecordImpl = new Map();
  Array.from(r.entries()).forEach(([k, v]) => {
    if (k !== __FROZEN__) {
      newRecord.set(k, v);
    }
  });
  return ((newRecord: any): Record);
}

/**
 * @public
 *
 * Copies all fields from `source` to `sink`, excluding `__id` and `__typename`.
 *
 * NOTE: This function does not treat `id` specially. To preserve the id,
 * manually reset it after calling this function. Also note that values are
 * copied by reference and not value; callers should ensure that values are
 * copied on write.
 */
function copyFields(sourceOriginal: Record, sinkOriginal: Record): void {
  const source = ((sourceOriginal: any): RecordImpl);
  const sink = ((sinkOriginal: any): RecordImpl);
  Array.from(source.entries()).forEach(([k, v]) => {
    if (source.has(k)) {
      if (k !== ID_KEY && k !== TYPENAME_KEY) {
        sink.set(k, v);
      }
    }
  });
}

/**
 * @public
 *
 * Create a new record.
 */
function create(dataID: DataID, typeName: string): Record {
  // See perf note above for why we aren't using computed property access.
  const record: RecordImpl = new Map();
  record.set(ID_KEY, dataID);
  record.set(TYPENAME_KEY, typeName);
  return ((record: any): Record);
}

/**
 * @public
 *
 * Get the record's `id` if available or the client-generated identifier.
 */
function getDataID(record: Record): DataID {
  const r = ((record: any): RecordImpl);
  return (r.get(ID_KEY): any);
}

/**
 * @public
 *
 * Get the concrete type of the record.
 */
function getType(record: Record): string {
  const r = ((record: any): RecordImpl);
  return (r.get(TYPENAME_KEY): any);
}

/**
 * @public
 *
 * Get a scalar (non-link) field value.
 */
function getValue(r: Record, storageKey: string): mixed {
  const record = ((r: any): RecordImpl);
  const value = record.get(storageKey);
  if (value && typeof value === 'object') {
    invariant(
      !value.hasOwnProperty(REF_KEY) && !value.hasOwnProperty(REFS_KEY),
      'RelayModernRecord.getValue(): Expected a scalar (non-link) value for `%s.%s` ' +
        'but found %s.',
      record.get(ID_KEY),
      storageKey,
      value.hasOwnProperty(REF_KEY)
        ? 'a linked record'
        : 'plural linked records',
    );
  }
  return value;
}

/**
 * @public
 *
 * Get the value of a field as a reference to another record. Throws if the
 * field has a different type.
 */
function getLinkedRecordID(r: Record, storageKey: string): ?DataID {
  const record = ((r: any): RecordImpl);
  const link = record.get(storageKey);
  if (link == null) {
    return link;
  }
  invariant(
    typeof link === 'object' && link && typeof link[REF_KEY] === 'string',
    'RelayModernRecord.getLinkedRecordID(): Expected `%s.%s` to be a linked ID, ' +
      'was `%s`.',
    record.get(ID_KEY),
    storageKey,
    JSON.stringify(link),
  );
  return link[REF_KEY];
}

/**
 * @public
 *
 * Get the value of a field as a list of references to other records. Throws if
 * the field has a different type.
 */
function getLinkedRecordIDs(r: Record, storageKey: string): ?Array<?DataID> {
  const record = ((r: any): RecordImpl);
  const links = record.get(storageKey);
  if (links == null) {
    return links;
  }
  invariant(
    typeof links === 'object' && Array.isArray(links[REFS_KEY]),
    'RelayModernRecord.getLinkedRecordIDs(): Expected `%s.%s` to contain an array ' +
      'of linked IDs, got `%s`.',
    record.get(ID_KEY),
    storageKey,
    JSON.stringify(links),
  );
  // assume items of the array are ids
  return (links[REFS_KEY]: any);
}

/**
 * @public
 *
 * Returns the epoch at which the record was invalidated, if it
 * ever was; otherwise returns null;
 */
function getInvalidationEpoch(r: ?Record): ?number {
  const record = ((r: any): ?RecordImpl);
  if (record == null) {
    return null;
  }

  const invalidatedAt = record.get(INVALIDATED_AT_KEY);
  if (typeof invalidatedAt !== 'number') {
    // If the record has never been invalidated, it isn't stale.
    return null;
  }
  return invalidatedAt;
}

/**
 * @public
 *
 * Compares the fields of a previous and new record, returning either the
 * previous record if all fields are equal or a new record (with merged fields)
 * if any fields have changed.
 */
function update(prevR: Record, nextR: Record): Record {
  const prevRecord = ((prevR: any): RecordImpl);
  const nextRecord = ((nextR: any): RecordImpl);
  if (__DEV__) {
    const prevID = getDataID(prevR);
    const nextID = getDataID(nextR);
    warning(
      prevID === nextID,
      'RelayModernRecord: Invalid record update, expected both versions of ' +
        'the record to have the same id, got `%s` and `%s`.',
      prevID,
      nextID,
    );
    // note: coalesce null/undefined to null
    const prevType = getType(prevR) ?? null;
    const nextType = getType(nextR) ?? null;
    warning(
      isClientID(nextID) || prevType === nextType,
      'RelayModernRecord: Invalid record update, expected both versions of ' +
        'record `%s` to have the same `%s` but got conflicting types `%s` ' +
        'and `%s`. The GraphQL server likely violated the globally unique ' +
        'id requirement by returning the same id for different objects.',
      prevID,
      TYPENAME_KEY,
      prevType,
      nextType,
    );
  }
  let updated: RecordImpl | null = null;
  const keys = Array.from(nextRecord.keys());
  for (let ii = 0; ii < keys.length; ii++) {
    const key = keys[ii];
    if (updated || !areEqual(prevRecord.get(key), nextRecord.get(key))) {
      updated = updated !== null ? updated : ((clone(prevR): any): RecordImpl);
      updated.set(key, nextRecord.get(key));
    }
  }
  return (((updated !== null ? updated : prevRecord): any): Record);
}

/**
 * @public
 *
 * Returns a new record with the contents of the given records. Fields in the
 * second record will overwrite identical fields in the first record.
 */
function merge(r1: Record, r2: Record): Record {
  const record1 = ((clone(r1): any): RecordImpl);
  const record2 = ((r2: any): RecordImpl);
  if (__DEV__) {
    const prevID = getDataID(r1);
    const nextID = getDataID(r2);
    warning(
      prevID === nextID,
      'RelayModernRecord: Invalid record merge, expected both versions of ' +
        'the record to have the same id, got `%s` and `%s`.',
      prevID,
      nextID,
    );
    // note: coalesce null/undefined to null
    const prevType = getType(r1) ?? null;
    const nextType = getType(r2) ?? null;
    warning(
      isClientID(nextID) || prevType === nextType,
      'RelayModernRecord: Invalid record merge, expected both versions of ' +
        'record `%s` to have the same `%s` but got conflicting types `%s` ' +
        'and `%s`. The GraphQL server likely violated the globally unique ' +
        'id requirement by returning the same id for different objects.',
      prevID,
      TYPENAME_KEY,
      prevType,
      nextType,
    );
  }

  Array.from(record2.entries()).forEach(([k, v]) => record1.set(k, v));

  return ((record1: any): Record);
}

/**
 * @public
 *
 * Prevent modifications to the record. Attempts to call `set*` functions on a
 * frozen record will fatal at runtime.
 */
function isFrozen(record: Record): boolean {
  const r = ((record: any): RecordImpl);
  const frozen = r.get(__FROZEN__);
  return frozen === true;
}

/**
 * @public
 *
 * Prevent modifications to the record. Attempts to call `set*` functions on a
 * frozen record will fatal at runtime.
 */
function freeze(record: Record): void {
  const r = ((record: any): RecordImpl);
  r.set(__FROZEN__, true);
}

/**
 * @public
 *
 * Set the value of a storageKey to a scalar.
 */
function setValue(r: Record, storageKey: string, value: mixed): void {
  const record = ((r: any): RecordImpl);
  const frozen = record.get(__FROZEN__);
  if (frozen === true) {
    throw new TypeError('Cannot mutate frozen record');
  }
  if (__DEV__) {
    const prevID = getDataID(r);
    if (storageKey === ID_KEY) {
      warning(
        prevID === value,
        'RelayModernRecord: Invalid field update, expected both versions of ' +
          'the record to have the same id, got `%s` and `%s`.',
        prevID,
        value,
      );
    } else if (storageKey === TYPENAME_KEY) {
      // note: coalesce null/undefined to null
      const prevType = getType(r) ?? null;
      const nextType = value ?? null;
      warning(
        isClientID(getDataID(r)) || prevType === nextType,
        'RelayModernRecord: Invalid field update, expected both versions of ' +
          'record `%s` to have the same `%s` but got conflicting types `%s` ' +
          'and `%s`. The GraphQL server likely violated the globally unique ' +
          'id requirement by returning the same id for different objects.',
        prevID,
        TYPENAME_KEY,
        prevType,
        nextType,
      );
    }
  }
  record.set(storageKey, value);
}

/**
 * @public
 *
 * Set the value of a field to a reference to another record.
 */
function setLinkedRecordID(
  r: Record,
  storageKey: string,
  linkedID: DataID,
): void {
  const record = ((r: any): RecordImpl);
  // See perf note above for why we aren't using computed property access.
  const link = {};
  link[REF_KEY] = linkedID;
  record.set(storageKey, link);
}

/**
 * @public
 *
 * Set the value of a field to a list of references other records.
 */
function setLinkedRecordIDs(
  r: Record,
  storageKey: string,
  linkedIDs: Array<?DataID>,
): void {
  const record = ((r: any): RecordImpl);
  // See perf note above for why we aren't using computed property access.
  const links = {};
  links[REFS_KEY] = linkedIDs;
  record.set(storageKey, links);
}

function fromObj(record: RecordObj): Record {
  return ((new Map(Object.entries(record)): any): Record);
}

function toObj(r: ?Record): RecordObj {
  if (r) {
    let record = ((r: any): RecordImpl);
    let obj: RecordObj = {};
    for (let [k, v] of record) {
      // We don’t escape the key '__proto__'
      // which can cause problems on older engines
      if (k === __FROZEN__) {
        continue;
      }

      obj[k] = v;
    }
    return obj;
  }
  return {};
}

const RelayModernRecordObjImpl: RelayModernRecordType = {
  clone,
  copyFields,
  create,
  isFrozen,
  freeze,
  getDataID,
  getInvalidationEpoch,
  getLinkedRecordID,
  getLinkedRecordIDs,
  getType,
  getValue,
  merge,
  setValue,
  setLinkedRecordID,
  setLinkedRecordIDs,
  update,
  fromObj,
  toObj,
};

module.exports = RelayModernRecordObjImpl;
