/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @emails oncall+relay
 */

'use strict';

const RelayModernRecord = require('../RelayModernRecord');
const RelayModernTestUtils = require('relay-test-utils-internal');
const RelayStoreUtils = require('../RelayStoreUtils');

const deepFreeze = require('../../util/deepFreeze');

const {ID_KEY, REF_KEY, REFS_KEY, TYPENAME_KEY} = RelayStoreUtils;

describe('RelayModernRecord', () => {
  beforeEach(() => {
    expect.extend(RelayModernTestUtils.matchers);
  });

  describe('clone', () => {
    it('returns a shallow copy of the record', () => {
      const record = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(record, 'name', 'Mark');
      RelayModernRecord.setLinkedRecordID(record, 'pet', 'beast');
      const clone = RelayModernRecord.clone(record);
      expect(clone).toEqual(record);
      expect(clone).not.toBe(record);
      expect(clone.pet).toBe(record.pet);
    });
  });

  describe('copyFields()', () => {
    it('copies fields', () => {
      const sink = RelayModernRecord.fromObj({
        [ID_KEY]: '4',
        [TYPENAME_KEY]: 'User',
      });
      const source = RelayModernRecord.fromObj({
        [ID_KEY]: '__4',
        [TYPENAME_KEY]: '__User',
        name: 'Zuck',
        pet: {[REF_KEY]: 'beast'},
        pets: {[REFS_KEY]: ['beast']},
      });
      RelayModernRecord.freeze(source);
      RelayModernRecord.copyFields(source, sink);
      expect(RelayModernRecord.toObj(sink)).toEqual({
        [ID_KEY]: '4',
        [TYPENAME_KEY]: 'User',
        name: 'Zuck',
        pet: {[REF_KEY]: 'beast'},
        pets: {[REFS_KEY]: ['beast']},
      });
      // values are copied by reference not value
      expect(sink.pet).toBe(source.pet);
      expect(sink.pets).toBe(source.pets);
    });
  });

  describe('getLinkedRecordIDs()', () => {
    let record;

    beforeEach(() => {
      record = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(record, 'name', 'Mark');
      RelayModernRecord.setValue(record, 'enemies', null);
      RelayModernRecord.setLinkedRecordID(record, 'hometown', 'mpk');
      RelayModernRecord.setLinkedRecordIDs(record, 'friends{"first":10}', [
        'beast',
        'greg',
        null,
      ]);
    });

    it('returns undefined when the link is unknown', () => {
      expect(RelayModernRecord.getLinkedRecordIDs(record, 'colors')).toBe(
        undefined,
      );
    });

    it('returns null when the link is non-existent', () => {
      expect(RelayModernRecord.getLinkedRecordIDs(record, 'enemies')).toBe(
        null,
      );
    });

    it('returns the linked record IDs when they exist', () => {
      expect(
        RelayModernRecord.getLinkedRecordIDs(record, 'friends{"first":10}'),
      ).toEqual(['beast', 'greg', null]);
    });

    it('throws if the field is actually a scalar', () => {
      expect(() =>
        RelayModernRecord.getLinkedRecordIDs(record, 'name'),
      ).toThrowError(
        'RelayModernRecord.getLinkedRecordIDs(): Expected `4.name` to contain ' +
          'an array of linked IDs, got `Mark`.',
      );
    });

    it('throws if the field is a singular link', () => {
      expect(() =>
        RelayModernRecord.getLinkedRecordIDs(record, 'hometown'),
      ).toThrowError(
        'RelayModernRecord.getLinkedRecordIDs(): Expected `4.hometown` to contain ' +
          'an array of linked IDs, got `ref:mpk`.',
      );
    });
  });

  describe('setLinkedRecordID()', () => {
    it('sets a link', () => {
      const record = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setLinkedRecordID(record, 'pet', 'beast');
      expect(RelayModernRecord.getLinkedRecordID(record, 'pet')).toBe('beast');
    });
  });

  describe('setLinkedRecordIDs()', () => {
    it('sets an array of links', () => {
      const record = RelayModernRecord.create('4', 'User');
      const storageKey = 'friends{"first":10}';
      RelayModernRecord.setLinkedRecordIDs(record, storageKey, [
        'beast',
        'greg',
        null,
      ]);
      expect(RelayModernRecord.getLinkedRecordIDs(record, storageKey)).toEqual([
        'beast',
        'greg',
        null,
      ]);
    });
  });

  describe('getValue()', () => {
    let record;

    beforeEach(() => {
      record = RelayModernRecord.create(4, 'User');
      RelayModernRecord.setValue(record, 'name', 'Mark');
      RelayModernRecord.setValue(record, 'blockbusterMembership', null);
      RelayModernRecord.setValue(record, 'age', undefined);
      RelayModernRecord.setLinkedRecordID(record, 'hometown', 'mpk');
      RelayModernRecord.setLinkedRecordIDs(record, 'friends{"first":10}', [
        'beast',
        'greg',
      ]);
      RelayModernRecord.setValue(record, 'favoriteColors', [
        'red',
        'green',
        'blue',
      ]);
      RelayModernRecord.setValue(record, 'other', {customScalar: true});
    });

    it('returns a scalar value', () => {
      expect(RelayModernRecord.getValue(record, 'name')).toBe('Mark');
    });

    it('returns null', () => {
      expect(RelayModernRecord.getValue(record, 'blockbusterMembership')).toBe(
        null,
      );
    });

    it('returns undefined', () => {
      expect(RelayModernRecord.getValue(record, 'age')).toBe(undefined);
    });

    it('returns a (list) scalar value', () => {
      // Note that lists can be scalars too. The definition of scalar value is
      // "not a singular or plural link", and means that no query can traverse
      // into it.
      expect(RelayModernRecord.getValue(record, 'favoriteColors')).toEqual([
        'red',
        'green',
        'blue',
      ]);
    });

    it('returns a (custom object) scalar value', () => {
      // Objects can be scalars too. The definition of scalar value is
      // "not a singular or plural link", and means that no query can traverse
      // into it.
      expect(RelayModernRecord.getValue(record, 'other')).toEqual({
        customScalar: true,
      });
    });

    it('returns null when the field is non-existent', () => {
      expect(RelayModernRecord.getValue(record, 'blockbusterMembership')).toBe(
        null,
      );
    });

    it('returns undefined when the field is unknown', () => {
      expect(RelayModernRecord.getValue(record, 'horoscope')).toBe(undefined);
    });

    it('throws on encountering a linked record', () => {
      expect(() => RelayModernRecord.getValue(record, 'hometown')).toThrowError(
        'RelayModernRecord.getValue(): Expected a scalar (non-link) value for ' +
          '`4.hometown` but found a linked record.',
      );
    });

    it('throws on encountering a plural linked record', () => {
      expect(() =>
        RelayModernRecord.getValue(record, 'friends{"first":10}'),
      ).toThrowError(
        'RelayModernRecord.getValue(): Expected a scalar (non-link) value for ' +
          '`4.friends{"first":10}` but found plural linked records.',
      );
    });
  });

  describe('freeze()', () => {
    it('prevents modification of records', () => {
      const record = RelayModernRecord.create('4', 'User');
      RelayModernRecord.freeze(record);
      expect(() => {
        RelayModernRecord.setValue(record, 'pet', 'Beast');
      }).toThrow(TypeError);
    });
  });

  describe('update()', () => {
    it('returns the first record if there are no changes', () => {
      const prev = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(prev, 'name', 'Zuck');
      const next = RelayModernRecord.clone(prev);
      const updated = RelayModernRecord.update(prev, next);
      expect(updated).toBe(prev);
      expect(updated).not.toBe(next);
      const r = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(r, 'name', 'Zuck');
      expect(updated).toEqual(r);
    });

    it('returns a new record if there are changes', () => {
      const prev = RelayModernRecord.create('4', 'User');
      const next = RelayModernRecord.clone(prev);
      RelayModernRecord.setValue(next, 'name', 'Zuck');
      const updated = RelayModernRecord.update(prev, next);
      expect(updated).not.toBe(prev);
      expect(updated).not.toBe(next);
      const r = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(r, 'name', 'Zuck');
      expect(updated).toEqual(r);
    });

    it('warns if __id does not match', () => {
      jest.mock('warning');
      const prev = RelayModernRecord.create('4', 'User');
      const next = RelayModernRecord.create('5', 'User');
      expect(() => RelayModernRecord.update(prev, next)).toWarn([
        'RelayModernRecord: Invalid record update, expected both versions ' +
          'of the record to have the same id, got `%s` and `%s`.',
        '4',
        '5',
      ]);
    });

    it('warns if __typename does not match', () => {
      jest.mock('warning');
      const prev = RelayModernRecord.create('42', 'Number');
      const next = RelayModernRecord.create('42', 'MeaningOfLife');
      expect(() => RelayModernRecord.update(prev, next)).toWarn([
        'RelayModernRecord: Invalid record update, expected both versions ' +
          'of record `%s` to have the same `%s` but got conflicting types ' +
          '`%s` and `%s`. The GraphQL server likely violated the globally ' +
          'unique id requirement by returning the same id for different objects.',
        '42',
        '__typename',
        'Number',
        'MeaningOfLife',
      ]);
    });

    it('does not warn if __typename does not match on client record', () => {
      jest.mock('warning');
      const prev = RelayModernRecord.create('client:42', 'Number');
      const next = RelayModernRecord.create('client:42', 'MeaningOfLife');
      expect(() => RelayModernRecord.update(prev, next)).not.toWarn();
    });
  });

  describe('merge()', () => {
    it('returns a new record even if there are no changes', () => {
      const prev = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(prev, 'name', 'Zuck');
      const next = RelayModernRecord.clone(prev);
      const updated = RelayModernRecord.merge(prev, next);
      expect(updated).not.toBe(prev);
      expect(updated).not.toBe(next);
      const r = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(r, 'name', 'Zuck');
      expect(updated).toEqual(r);
    });

    it('returns a new record if there are changes', () => {
      const prev = RelayModernRecord.create('4', 'User');
      const next = RelayModernRecord.clone(prev);
      RelayModernRecord.setValue(next, 'name', 'Zuck');
      const updated = RelayModernRecord.merge(prev, next);
      expect(updated).not.toBe(prev);
      expect(updated).not.toBe(next);
      const r = RelayModernRecord.create('4', 'User');
      RelayModernRecord.setValue(r, 'name', 'Zuck');
      expect(updated).toEqual(r);
    });

    it('warns if __id does not match', () => {
      jest.mock('warning');
      const prev = RelayModernRecord.create('4', 'User');
      const next = RelayModernRecord.create('5', 'User');
      expect(() => RelayModernRecord.merge(prev, next)).toWarn([
        'RelayModernRecord: Invalid record merge, expected both versions of ' +
          'the record to have the same id, got `%s` and `%s`.',
        '4',
        '5',
      ]);
    });

    it('warns if __typename does not match', () => {
      jest.mock('warning');
      const prev = RelayModernRecord.create('42', 'Number');
      const next = RelayModernRecord.create('42', 'MeaningOfLife');
      expect(() => RelayModernRecord.merge(prev, next)).toWarn([
        'RelayModernRecord: Invalid record merge, expected both versions of ' +
          'record `%s` to have the same `%s` but got conflicting types `%s` ' +
          'and `%s`. The GraphQL server likely violated the globally unique ' +
          'id requirement by returning the same id for different objects.',
        '42',
        '__typename',
        'Number',
        'MeaningOfLife',
      ]);
    });

    it('does not warn if __typename does not match on client record', () => {
      jest.mock('warning');
      const prev = RelayModernRecord.create('client:42', 'Number');
      const next = RelayModernRecord.create('client:42', 'MeaningOfLife');
      expect(() => RelayModernRecord.merge(prev, next)).not.toWarn();
    });
  });

  describe('setValue()', () => {
    it('warns if updating to a different __id', () => {
      jest.mock('warning');
      const record = RelayModernRecord.create('4', 'User');
      expect(() => RelayModernRecord.setValue(record, ID_KEY, 'not-4')).toWarn([
        'RelayModernRecord: Invalid field update, expected both versions of ' +
          'the record to have the same id, got `%s` and `%s`.',
        '4',
        'not-4',
      ]);
    });

    it('warns if updating to a different __typename', () => {
      jest.mock('warning');
      const record = RelayModernRecord.create('4', 'User');
      expect(() =>
        RelayModernRecord.setValue(record, TYPENAME_KEY, 'not-User'),
      ).toWarn([
        'RelayModernRecord: Invalid field update, expected both versions of ' +
          'record `%s` to have the same `%s` but got conflicting types `%s` ' +
          'and `%s`. The GraphQL server likely violated the globally unique ' +
          'id requirement by returning the same id for different objects.',
        '4',
        '__typename',
        'User',
        'not-User',
      ]);
    });

    it('does not warn if updating the __typename of a client record', () => {
      jest.mock('warning');
      const record = RelayModernRecord.create('client:4', 'User');
      expect(() =>
        RelayModernRecord.setValue(record, TYPENAME_KEY, 'not-User'),
      ).not.toWarn();
    });
  });

  describe('JSON', () => {
    it('can convert fromObj', () => {
      const recordObj = {
        [ID_KEY]: '4',
        [TYPENAME_KEY]: 'User',
        name: 'Mark',
      };

      const record = RelayModernRecord.fromObj(recordObj);
      expect(RelayModernRecord.toObj(record)).toEqual(recordObj);
    });

    it('can handle null values', () => {
      const storeData = {
        id: '1',
        __typename: 'User',
        'nameRenderer(supported:["PlainUserNameRenderer","MarkdownUserNameRenderer"])': null,
      };

      const record = RelayModernRecord.fromObj(storeData);
      expect(RelayModernRecord.toObj(record)).toEqual(storeData);
    });

    it('can handle undefined values', () => {
      const storeData = {
        id: '1',
        __typename: 'User',
        uri: undefined,
      };

      const record = RelayModernRecord.fromObj(storeData);
      expect(RelayModernRecord.toObj(record)).toEqual(storeData);
    });

    it('can handle null in refs', () => {
      const data = {
        id: 'client:1',
        __typename: 'FriendsConnection',
        edges: {
          __refs: ['client:2', null, 'client:3'],
        },
      };
      const record = RelayModernRecord.fromObj(data);
      expect(RelayModernRecord.toObj(record)).toEqual(data);
    });
  });
});
