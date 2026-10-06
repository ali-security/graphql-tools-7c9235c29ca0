import { mergeDeep } from '@graphql-tools/utils';

describe('mergeDeep', () => {
  test('merges deeply', () => {
    const x = { a: { one: 1 } };
    const y = { a: { two: 2 } };
    expect(mergeDeep([x, y])).toEqual({ a: { one: 1, two: 2 } });
  });

  test('strips property symbols', () => {
    const x = {};
    const symbol = Symbol('symbol');
    x[symbol] = 'value';
    const y = { a: 2 };

    const merged = mergeDeep([x, y]);
    expect(merged).toStrictEqual({ a: 2 });
    expect(Object.getOwnPropertySymbols(merged)).toEqual([]);
  });

  test('merges prototypes', () => {
    const ClassA = class {
      a() {
        return 'a';
      }
    };
    const ClassB = class {
      b() {
        return 'b';
      }
    };

    const merged = mergeDeep([new ClassA(), new ClassB()], true);
    expect(merged.a()).toEqual('a');
    expect(merged.b()).toEqual('b');
  });

  test('merges prototype deeply', () => {
    const ClassA = class {
      a() {
        return 'a';
      }
    };
    const ClassB = class {
      b() {
        return 'b';
      }
    };

    const merged = mergeDeep([{ one: new ClassA() }, { one: new ClassB() }], true);
    expect(merged.one.a()).toEqual('a');
    expect(merged.one.b()).toEqual('b');
    expect(merged.a).toBeUndefined();
  });

  it('does not let an own __proto__ key from a source change the prototype of the output', () => {
    // json parsing makes __proto__ a real own enumerable key, unlike an object literal
    const payload = JSON.parse('{"nested":{"__proto__":{"polluted":"yes"}}}');
    const merged = mergeDeep([{ nested: { a: 1 } }, payload]);
    expect(merged.nested.a).toEqual(1);
    expect(merged.nested.polluted).toBeUndefined();
    expect(Object.getPrototypeOf(merged.nested)).toBe(Object.prototype);
  });

  it('does not walk into inherited constructor/prototype when merging', () => {
    const payload = JSON.parse('{"constructor":{"prototype":{"polluted":"yes"}}}');
    const merged = mergeDeep([{ a: 1 }, payload]);
    expect(merged.a).toEqual(1);
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('does not let a top-level __proto__ key change the prototype of the output', () => {
    const objectPayload = JSON.parse('{"__proto__":{"polluted":"yes"}}');
    const arrayPayload = JSON.parse('{"__proto__":["yes"]}');
    for (const respectPrototype of [false, true]) {
      const mergedObject = mergeDeep([{ a: 1 }, objectPayload], respectPrototype);
      expect(mergedObject.a).toEqual(1);
      expect(mergedObject.polluted).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(mergedObject, '__proto__')).toBe(false);

      const mergedArray = mergeDeep([{ a: 1 }, arrayPayload], respectPrototype);
      expect(mergedArray.a).toEqual(1);
      expect(Array.isArray(Object.getPrototypeOf(mergedArray))).toBe(false);
      expect(mergedArray.length).toBeUndefined();
    }
    expect(Object.getPrototypeOf(mergeDeep([{ a: 1 }, objectPayload]))).toBe(Object.prototype);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('does not reach Object.prototype or Function.prototype through constructor/__proto__ keys', () => {
    const payload = JSON.parse('{"constructor":{"__proto__":{"call":"x","polluted":"yes"}}}');
    const merged = mergeDeep([{ a: 1 }, payload]);
    expect(merged.a).toEqual(1);
    expect(Object.prototype.hasOwnProperty.call(merged, 'constructor')).toBe(false);
    expect(merged.constructor).toBe(Object);
    expect(({} as any).call).toBeUndefined();
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty('call');
    expect(typeof Function.prototype.call).toBe('function');
    expect(() => (() => 'still works').call(null)).not.toThrow();
  });

  it('does not use inherited properties as merge targets', () => {
    const payload = JSON.parse('{"toString":{"x":1},"hasOwnProperty":{"y":2}}');
    const merged = mergeDeep([{ a: 1 }, payload]);
    expect(merged.a).toEqual(1);
    expect(merged.toString).toEqual({ x: 1 });
    expect(merged.hasOwnProperty).toEqual({ y: 2 });
    expect(typeof Object.prototype.toString).toBe('function');
    expect(typeof Object.prototype.hasOwnProperty).toBe('function');
  });
});
