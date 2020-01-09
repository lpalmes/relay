// export interface RelayModernRecordType {
//   clone(record: Record): Record;
//   copyFields(sourceOriginal: Record, sinkOriginal: Record): void;
//   create(dataID: DataID, typeName: string): Record;
//   freeze(record: Record): void;
//   getDataID(record: Record): DataID;
//   getInvalidationEpoch(r: ?Record): ?number;
//   getLinkedRecordID(r: Record, storageKey: string): ?DataID;
//   getLinkedRecordIDs(r: Record, storageKey: string): ?Array<?DataID>;
//   getType(record: Record): string;
//   getValue(r: Record, storageKey: string): mixed;
//   merge(r1: Record, r2: Record): Record;
//   setValue(r: Record, storageKey: string, value: mixed): void;
//   setLinkedRecordID(r: Record, storageKey: string, linkedID: DataID): void;
//   setLinkedRecordIDs(
//     r: Record,
//     storageKey: string,
//     linkedIDs: Array<?DataID>,
//   ): void;
//   update(prevR: Record, nextR: Record): Record;
//   fromObj(record: RecordObj): Record;
//   toObj(record: Record): RecordObj;
// }

type value = string;
type dataId = string;

module type Record = {
  type record;

  let clone: record => record;
  let copyFields: (record, record) => unit;
  let create: (dataId, string) => record;
  let freeze: record => unit;
  let getDataID: record => dataId;
  let getInvalidationEpoch: option(record) => option(int);
  let getLinkedRecordID: (record, string) => option(dataId);
  let getLinkedRecordIDs: (record, string) => array(option(dataId));
  let getType: record => string;
  let getValue: (record, string) => value;
  let merge: (record, record) => record;
  let setValue: (record, string, value) => unit;
  let setLinkedRecordID: (record, string, dataId) => unit;
  let setLinkedRecordIDs: (record, string, array(option(dataId))) => unit;
  let update: (record, record) => record;
};