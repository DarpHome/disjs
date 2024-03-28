const { Snowflake } = require("./snowflake");

class EmojiBuilder {
    constructor(id, name, animated = false) {
        this.id = id ?? null;
        this.name = name;
        this.animated = animated;
    }

    static unicode(emoji) {
        return new EmojiBuilder(null, emoji, false);
    }

    encode() {
        return id === null ? encodeURIComponent(this.name) : encodeURIComponent(this.name) + ':' + encodeURIComponent(id);
    }

    build() {
        return id === null ? {name: this.name} : {id: Snowflake.stringFrom(id), animated};
    }
}