ace.define('ace/mode/dfkup_highlight_rules', ['require', 'exports', 'ace/lib/oop', 'ace/mode/text_highlight_rules'], function(require, exports, module) {
  var oop = require('ace/lib/oop')
  var TextHighlightRules = require('ace/mode/text_highlight_rules').TextHighlightRules

  var DfkupHighlightRules = function() {
    var keywords = (
      'var|let|const|fn|func|result|return|if|elif|else|case|of|' +
      'while|for|in|break|continue|yield|and|or|is|isnot|not|' +
      'type|object|iterator|macro|discard|import|include|coro|mod'
    )

    var builtins = (
      'echo|assert|len|high|inc|' +
      'fileExists|dirExists|readFile|writeFile|copyFile|' +
      'moveFile|removeFile|createDir|removeDir|listDir|' +
      'getCurrentDir|setCurrentDir|joinPath|parentDir|' +
      'expandFilename|absolutePath|getEnv|existsEnv|' +
      'getAppDir|getAppFilename|sleep|getCurrentProcessId|getFileSize|' +
      'parseJson|dump|pretty|keys|values|join|get|' +
      'toUpper|toLower|capitalize|replace|startsWith|endsWith|' +
      'contains|repeat|strip|split|parseInt|parseFloat|parseBool|' +
      'add|max|min|sort|concat|map|filter|foldl|foldr|' +
      'all|any|count|delete|insert|keepIf|pop|reversed|' +
      'items|range'
    )

    var constants = 'true|false|nil'

    // HTML elements usable as Tim element tags (`div.container`,
    // `h1: "Hi"`, `ul > li`, ...), highlighted like HTML tags.
    var tags = (
      'a|abbr|address|area|article|aside|audio|b|base|bdi|bdo|' +
      'blockquote|body|br|button|canvas|caption|cite|code|col|colgroup|' +
      'data|datalist|dd|del|details|dfn|dialog|div|dl|dt|em|embed|' +
      'fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|head|' +
      'header|hgroup|hr|html|i|iframe|img|input|ins|kbd|label|legend|' +
      'li|link|main|map|mark|meta|meter|nav|noscript|object|ol|optgroup|' +
      'option|output|p|picture|pre|progress|q|rp|rt|ruby|s|samp|' +
      'script|section|select|small|source|span|strong|style|sub|summary|' +
      'sup|table|tbody|td|template|textarea|tfoot|th|thead|time|title|' +
      'tr|track|u|ul|var|video|wbr'
    )

    var keywordMapper = this.createKeywordMapper({
      'keyword': keywords,
      'support.function': builtins,
      'constant.language': constants,
      'variable.language': 'result',
      'entity.name.tag': tags
    }, 'identifier')

    this.$rules = {
      start: [
        // Tim line/block comments (`//`, `/* */`). `#` is the id
        // shorthand in Tim, not a comment.
        { token: 'comment.line', regex: /\/\/.*$/ },
        { token: 'comment.block', regex: /\/\*/, next: 'comment_block' },
        // `.class` / `#id` shorthand after an element tag.
        { token: 'entity.other.attribute-name', regex: /[.#][a-zA-Z_][a-zA-Z0-9_-]*/ },
        // Directives (`@include`, `@view`, `@client`, `@end`, ...).
        { token: 'keyword.directive', regex: /@[a-zA-Z_][a-zA-Z0-9_-]*/ },
        // `$var` interpolation (`$this`, `$app`, `$name`).
        { token: 'variable', regex: /\$[a-zA-Z_][a-zA-Z0-9_-]*/ },
        { token: 'string.quoted.other', regex: /"""/, next: 'string_triple' },
        { token: 'string.quoted.double', regex: /"/, next: 'string_double' },
        { token: 'string.quoted.single', regex: /'/, next: 'string_single' },
        { token: 'string.quoted.backtick', regex: /`/, next: 'string_backtick' },
        { token: 'constant.numeric', regex: /\d[\d_]*(?:\.\d[\d_]*(?:[eE][+-]?\d[\d_]*)?)?/ },
        { token: keywordMapper, regex: /[a-zA-Z_][a-zA-Z0-9_-]*/ },
        { token: 'keyword.operator', regex: /\.\./ },
        { token: 'keyword.operator', regex: /&&|\|\||==|!=|<=|>=/ },
        { token: 'keyword.operator', regex: /[-+*\/%^=!<>&|:$@?>]/ },
        { token: 'punctuation', regex: /[{}()\[\],;.]/ },
      ],
      comment_block: [
        { token: 'comment.block', regex: /\*\//, next: 'start' },
        { defaultToken: 'comment.block' },
      ],
      string_double: [
        { token: 'constant.language.escape', regex: /\\(?:[nrt"\\0])/ },
        { token: 'string.quoted.double', regex: /"/, next: 'start' },
        { token: 'string.quoted.double', regex: /[^"\\]+/ },
        { defaultToken: 'string.quoted.double' },
      ],
      string_single: [
        { token: 'string.quoted.single', regex: /'/, next: 'start' },
        { token: 'string.quoted.single', regex: /[^']+/ },
        { defaultToken: 'string.quoted.single' },
      ],
      string_backtick: [
        { token: 'string.quoted.backtick', regex: /`/, next: 'start' },
        { token: 'string.quoted.backtick', regex: /[^`]+/ },
        { defaultToken: 'string.quoted.backtick' },
      ],
      string_triple: [
        { token: 'string.quoted.other', regex: /"""/, next: 'start' },
        { defaultToken: 'string.quoted.other' },
      ],
    }
  }

  oop.inherits(DfkupHighlightRules, TextHighlightRules)
  exports.DfkupHighlightRules = DfkupHighlightRules
})

ace.define('ace/mode/dfkup', ['require', 'exports', 'ace/lib/oop', 'ace/mode/text', 'ace/mode/dfkup_highlight_rules'], function(require, exports, module) {
  var oop = require('ace/lib/oop')
  var TextMode = require('ace/mode/text').Mode
  var DfkupHighlightRules = require('ace/mode/dfkup_highlight_rules').DfkupHighlightRules

  var Mode = function() {
    this.HighlightRules = DfkupHighlightRules
  }

  oop.inherits(Mode, TextMode)

  ;(function() {
    this.lineCommentStart = '//'
    this.$id = 'ace/mode/dfkup'
  }).call(Mode.prototype)

  exports.Mode = Mode
})
