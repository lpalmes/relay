module Warning = {
  [@bs.module] external warning: (bool, string) => unit = "warning";
  [@bs.module] external warning1: (bool, string, 'a) => unit = "warning";
  [@bs.module] external warning2: (bool, string, 'a, 'b) => unit = "warning";
  [@bs.module]
  external warning3: (bool, string, 'a, 'b, 'c) => unit = "warning";
  [@bs.module]
  external warning4: (bool, string, 'a, 'b, 'c, 'd) => unit = "warning";
  [@bs.module]
  external warning5: (bool, string, 'a, 'b, 'c, 'd, 'e) => unit = "warning";
  [@bs.module]
  external warning6: (bool, string, 'a, 'b, 'c, 'd, 'e, 'f) => unit =
    "warning";
};

let isClientID = id => {
  let f = [%bs.re "/^client:/"];
  Js.Re.test_(f, id);
};

type refs = array(option(string));

type customValue;

type value =
  | Null
  | Undefined
  | String(string)
  | Int(int)
  | Float(float)
  | Bool(bool)
  | Ref(string)
  | Refs(refs)
  | Custom(customValue)
  | Array(array(value));

type dataId = string;

type valueObj;
type recordObj = Js.Dict.t(Js.nullable(valueObj));

module type Record = {
  type record;

  let clone: record => record;
  let copyFields: (record, record) => unit;
  let create: (dataId, string) => record;
  let freeze: record => unit;
  let getDataID: record => dataId;
  let getInvalidationEpoch: Js.nullable(record) => Js.nullable(int);
  let getLinkedRecordID: (record, string) => Js.nullable(dataId);
  let getLinkedRecordIDs: (record, string) => Js.nullable(refs);
  let getType: record => string;
  let getValue: (record, string) => Js.nullable(valueObj);
  let merge: (record, record) => record;
  let setValue: (record, string, Js.nullable(valueObj)) => unit;
  let setLinkedRecordID: (record, string, dataId) => unit;
  let setLinkedRecordIDs: (record, string, refs) => unit;
  let update: (record, record) => record;
  let isFrozen: record => bool;
  let toObj: Js.nullable(record) => recordObj;
  let fromObj: recordObj => record;
};

module Keys = {
  let fragments_key = "__fragments";
  let fragment_owner_key = "__fragmentOwner";
  let fragment_prop_name_key = "__fragmentPropName";
  let module_component_key = "__module_component";
  let id_key = "__id";
  let ref_key = "__ref";
  let refs_key = "__refs";
  let root_id = "client=root";
  let root_type = "__Root";
  let typename_key = "__typename";
  let invalidated_at_key = "__invalidated_at";

  let frozen_key = "__frozen";
};

[@bs.val] external isInteger: 'a => bool = "Number.isInteger";

let rec transformValueFromObj = (valueObj: valueObj): value => {
  switch (Js.typeof(valueObj)) {
  | "string" => String(Obj.magic(valueObj))
  | "array" => Array(Array.map(transformValueFromObj, Obj.magic(valueObj)))
  | "boolean" => Bool(Obj.magic(valueObj))
  | "number" =>
    if (isInteger(valueObj)) {
      Int(Obj.magic(valueObj));
    } else {
      Float(Obj.magic(valueObj));
    }
  | "object" =>
    let objRef: Js.Dict.t(string) = valueObj |> Obj.magic;
    let objRefs: Js.Dict.t(refs) = valueObj |> Obj.magic;
    switch (
      Js.Dict.get(objRef, Keys.ref_key),
      Js.Dict.get(objRefs, Keys.refs_key),
    ) {
    | (Some(a), None) => Ref(a)
    | (None, Some(a)) => Refs(a)
    | _ => Custom(Obj.magic(valueObj))
    };
  | v =>
    Js.Exn.raiseTypeError(
      "Unhandled value type: "
      ++ Js.typeof(v)
      ++ " with value "
      ++ Js.Json.stringify(Obj.magic(valueObj)),
    )
  };
};

let rec transformValueToObj = (value: value): valueObj => {
  let valObj: valueObj =
    switch (value) {
    | Array(arr) => arr |> Array.map(transformValueToObj) |> Obj.magic
    | Custom(v) => v |> Obj.magic
    | String(v) => v |> Obj.magic
    | Bool(v) => v |> Obj.magic
    | Int(v) => v |> Obj.magic
    | Float(v) => v |> Obj.magic
    | Null => Js.Nullable.null |> Obj.magic
    | Undefined => Js.Nullable.undefined |> Obj.magic
    | Ref(v) =>
      let obj = Js.Dict.empty();
      Js.Dict.set(obj, Keys.ref_key, v);
      obj |> Obj.magic;
    | Refs(v) =>
      let obj = Js.Dict.empty();
      Js.Dict.set(obj, Keys.refs_key, v);
      obj |> Obj.magic;
    };
  valObj;
};

module ReasonRecordDict: Record = {
  type record = Js.Dict.t(value);

  let clone = r => {
    let clone = Js.Dict.empty();
    Array.iter(
      ((k, v)) =>
        if (k != Keys.frozen_key) {
          Js.Dict.set(clone, k, v);
        },
      Js.Dict.entries(r),
    );
    clone;
  };

  let copyFields = (a, b) => {
    a
    |> Js.Dict.entries
    |> Array.iter(((k, v)) =>
         if (k != Keys.id_key && k != Keys.typename_key) {
           Js.Dict.set(b, k, v);
         }
       );
  };

  let create = (dataId, typename) => {
    let r = Js.Dict.empty();
    let id =
      if (Js.typeof(dataId) === "number") {
        Js.Int.toString(Obj.magic(dataId));
      } else {
        dataId;
      };
    Js.Dict.set(r, Keys.id_key, String(id));
    Js.Dict.set(r, Keys.typename_key, String(typename));
    r;
  };

  let freeze = r => {
    Js.Dict.set(r, Keys.frozen_key, Bool(true));
  };

  let isFrozen = r => {
    switch (Js.Dict.get(r, Keys.frozen_key)) {
    | Some(Bool(v)) => v
    | _ => false
    };
  };

  let getDataID = r =>
    switch (Js.Dict.get(r, Keys.id_key)) {
    | Some(String(v)) => v
    | _ => ""
    };

  let getInvalidationEpoch = r => {
    switch (Js.Nullable.toOption(r)) {
    | Some(record) =>
      let invalidated = Js.Dict.get(record, Keys.invalidated_at_key);
      switch (invalidated) {
      | Some(Int(v)) => Js.Nullable.return(v)
      | _ => Js.Nullable.null
      };
    | None => Js.Nullable.null
    };
  };

  let getLinkedRecordID = (r, key) => {
    let v = Js.Dict.get(r, key);
    switch (v) {
    | Some(Ref(ref)) => Js.Nullable.return(ref)
    | None => Js.Nullable.undefined
    | Some(Null) => Js.Nullable.null
    | _ => Js.Exn.raiseError("WRONG")
    };
  };

  let getLinkedRecordIDs = (r, key) => {
    let v = Js.Dict.get(r, key);
    switch (v) {
    | Some(Refs(refs)) => Js.Nullable.return(refs)
    | None => Js.Nullable.undefined
    | Some(Null) => Js.Nullable.null
    | Some(value) =>
      let valueFormatted =
        switch (value) {
        | String(s) => s
        | Float(f) => Js.Float.toString(f)
        | Int(i) => string_of_int(i)
        | Bool(b) => string_of_bool(b)
        | Ref(ref) => "ref:" ++ ref
        | Null => "null"
        | _ => "Whatever left"
        };
      Printf.sprintf(
        "RelayModernRecord.getLinkedRecordIDs(): Expected `%s.%s` to contain an array of linked IDs, got `%s`.",
        getDataID(r),
        key,
        valueFormatted,
      )
      |> Js.Exn.raiseError;
    };
  };

  let getType = r => {
    switch (Js.Dict.get(r, Keys.typename_key)) {
    | Some(String(v)) => v
    | _ => ""
    };
  };

  let getValue = (r, key) => {
    let id = getDataID(r);
    switch (Js.Dict.get(r, key)) {
    | Some(Ref(_)) =>
      Printf.sprintf(
        "RelayModernRecord.getValue(): Expected a scalar (non-link) value for `%s.%s` but found a linked record.",
        id,
        key,
      )
      |> Js.Exn.raiseError
    | Some(Refs(_)) =>
      Printf.sprintf(
        "RelayModernRecord.getValue(): Expected a scalar (non-link) value for `%s.%s` but found plural linked records.",
        id,
        key,
      )
      |> Js.Exn.raiseError
    | Some(v) => Js.Nullable.return(transformValueToObj(v))
    | None => Js.Nullable.undefined
    };
  };

  let update = (a, b) => {
    let (aId, bId) = (getDataID(a), getDataID(b));
    Warning.warning2(
      aId == bId,
      "RelayModernRecord: Invalid record update, expected both versions of the record to have the same id, got `%s` and `%s`.",
      aId,
      bId,
    );
    let (aType, bType) = (getType(a), getType(b));
    Warning.warning4(
      isClientID(bId) || aType == bType,
      "RelayModernRecord: Invalid record update, expected both versions of record `%s` to have the same `%s` but got conflicting types `%s` and `%s`. The GraphQL server likely violated the globally unique id requirement by returning the same id for different objects.",
      bId,
      Keys.typename_key,
      aType,
      bType,
    );

    let record: ref(option(record)) = ref(None);
    b
    |> Js.Dict.entries
    |> Array.iter(((k, v)) =>
         if (record.contents != None
             || Js.Dict.get(a, k) != Js.Dict.get(b, k)) {
           switch (record.contents) {
           | None =>
             let newRecord = clone(a);
             Js.Dict.set(newRecord, k, v);
             record := Some(newRecord);
           | Some(r) => Js.Dict.set(r, k, v)
           };
         }
       );
    switch (record.contents) {
    | Some(newRecord) => newRecord
    | None => a
    };
  };

  let merge = (a, b) => {
    let (aId, bId) = (getDataID(a), getDataID(b));
    Warning.warning2(
      aId == bId,
      "RelayModernRecord: Invalid record merge, expected both versions of the record to have the same id, got `%s` and `%s`.",
      aId,
      bId,
    );
    let (aType, bType) = (getType(a), getType(b));
    Warning.warning4(
      isClientID(bId) || aType == bType,
      "RelayModernRecord: Invalid record merge, expected both versions of record `%s` to have the same `%s` but got conflicting types `%s` and `%s`. The GraphQL server likely violated the globally unique id requirement by returning the same id for different objects.",
      bId,
      Keys.typename_key,
      aType,
      bType,
    );
    let merged = clone(a);
    b
    |> Js.Dict.entries
    |> Array.iter(((k, v)) => Js.Dict.set(merged, k, v));
    merged;
  };

  let setValue = (r, key, valueObj) => {
    let value =
      if (Js.Nullable.null == valueObj) {
        Null;
      } else if (Js.Nullable.undefined == valueObj) {
        Undefined;
      } else {
        switch (Js.Nullable.toOption(valueObj)) {
        | Some(v) => transformValueFromObj(v)
        | None => Undefined
        };
      };

    switch (key, value) {
    | (k, String(v)) when k == Keys.id_key =>
      let prevId = getDataID(r);
      Warning.warning2(
        prevId == v,
        "RelayModernRecord: Invalid field update, expected both versions of the record to have the same id, got `%s` and `%s`.",
        prevId,
        v,
      );
    | (k, String(v)) when k == Keys.typename_key =>
      let prevID = getDataID(r);
      let prevType = getType(r);
      let nextType = v;
      Warning.warning4(
        isClientID(prevID) || prevType == nextType,
        "RelayModernRecord: Invalid field update, expected both versions of record `%s` to have the same `%s` but got conflicting types `%s` and `%s`. The GraphQL server likely violated the globally unique id requirement by returning the same id for different objects.",
        prevID,
        Keys.typename_key,
        prevType,
        nextType,
      );
    | _ => ()
    };

    switch (Js.Dict.get(r, Keys.frozen_key)) {
    | Some(Bool(true)) => Js.Exn.raiseTypeError("Record is frozen")
    | _ => Js.Dict.set(r, key, value)
    };
  };

  let setLinkedRecordID = (record, key, id) => {
    Js.Dict.set(record, key, Ref(id));
  };

  let setLinkedRecordIDs = (record, key, refs) =>
    Js.Dict.set(record, key, Refs(refs));

  let toObj = r => {
    let recordObj: recordObj = Js.Dict.empty();
    switch (Js.Nullable.toOption(r)) {
    | Some(record) =>
      record
      |> Js.Dict.entries
      |> Array.iter(((k, v)) =>
           if (k != Keys.frozen_key) {
             Js.Dict.set(
               recordObj,
               k,
               Js.Nullable.return(transformValueToObj(v)),
             );
           }
         )
    | None => ()
    };
    recordObj;
  };

  let fromObj = recordObj => {
    let record: record = Js.Dict.empty();
    recordObj
    |> Js.Dict.entries
    |> Array.iter(((k, v)) =>
         if (v == Js.Nullable.null) {
           Js.Dict.set(record, k, Null);
         } else {
           switch (Js.Nullable.toOption(v)) {
           | Some(value) =>
             Js.Dict.set(record, k, transformValueFromObj(value))
           | None => Js.Dict.set(record, k, Undefined)
           };
         }
       );
    record;
  };
};