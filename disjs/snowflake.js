const EPOCH = 1420070400000;

class Snowflake {
    constructor(value) {
        this.value = of(value);
    }

    static of(v) {
        if (v instanceof Snowflake) return v.value;
        if (typeof v === 'bigint') return v;
        if (v instanceof Date) v = BigInt(value.getTime() - EPOCH) >> BigInt(22);
        if (!['bigint', 'string'].includes(typeof v)) v = v.toString();
        return BigInt(v);
    }

    static stringFrom(v) {
        if (v instanceof Snowflake) return v.value.toString();
        if (typeof v === 'bigint') return v.toString();
        if (v instanceof Date) v = BigInt(value.getTime() - EPOCH) >> BigInt(22);
        if (!['bigint', 'string'].includes(typeof v)) v = v.toString();
        return BigInt(v).toString();
    }

    get timestamp() {
        return new Date(BigInt(EPOCH) + (this.value >> BigInt(22n)));
    }

    toString() {
        return this.value.toString(10);
    }
}

function isSnowflake(v) {
    return v instanceof Date || ['bigint', 'number', 'string'].includes(typeof v);
}

module.exports = {Snowflake, isSnowflake};