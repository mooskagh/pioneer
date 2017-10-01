(function($) {
  'use strict';

  // Array which resizes itself.
  function Array2D() {
    this.data = [];
    this.cols = 0;
  }
  Array2D.prototype.Set = function(row, col, val) {
    while (this.data.length <= row) this.data.push([]);
    while (this.data[row].length <= col) this.data[row].push(undefined);
    this.data[row][col] = val;
    if (this.cols < col + 1) this.cols = col + 1;
  };
  Array2D.prototype.Get = function(row, col) {
    var r = this.data[row];
    if (col < r.length) return r[col];
    return undefined;
  };
  Array2D.prototype.Rows = function() {
    return this.data.length;
  };
  Array2D.prototype.Cols = function() {
    return this.cols;
  };
  Array2D.prototype.IsUndefinedAbove = function(row, col) {
    for (var i = 0; i <= row; ++i)
      if (this.Get(i, col) !== undefined) return false;
    return true;
  }

  var formatters = {
    'int': function(el, val) {
      el.addClass('number').text(val);
    },
    'text': function(el, val) {
      el.addClass('text').text(val);
    },
    'default': function(el, val) {
      el.text(val);
    },
    'none': function(el, val) {
      el.text('(none)').addClass('empty');
    }
  }

  function Format(fmt, el, val) {
    if (val === null) fmt = 'none';
    else if (!formatters.hasOwnProperty(fmt)) fmt = 'default';
    formatters[fmt](el, val);
  }

  function IterateSchema(schema, opt_terminal, opt_msg_begin, opt_msg_end) {
    for (var i = 0; i < schema.length; ++i) {
      var item = schema[i];
      if (item.hasOwnProperty('subfields')) {
        if (opt_msg_begin) opt_msg_begin(item);
        IterateSchema(
          item['subfields'], opt_terminal, opt_msg_begin, opt_msg_end);
        if (opt_msg_end) opt_msg_end(item);
      } else {
        if (opt_terminal) opt_terminal(item);
      }
    }
  }

  function RenderHeader(schema, title, options) {
    options = options || {};
    var cells = new Array2D();
    var curRow = 0;
    var curCol = 0;
    if (options.collapsible) {
      cells.Set(0, 0, '');
      ++curCol;
    }

    IterateSchema(
      schema,
      function(item) {
        cells.Set(curRow, curCol, item.title);
        ++curCol;
      },
      function(item) {
        cells.Set(curRow, curCol, item.title);
        ++curRow;
      },
      function(item) {
        --curRow;
      });

    var element = $('<thead>');
    if (title) {
      var tr = $('<tr>').appendTo(element);
      $('<th>').attr('colspan', cells.Cols()).addClass('deeptable-title')
        .text(title).appendTo(tr);
    }
    for (var i = 0; i < cells.Rows(); ++i) {
      var tr = $('<tr>');
      for (var j = 0; j < cells.Cols(); ++j) {
        if (cells.Get(i, j) === undefined) continue;
        var text = cells.Get(i, j);
        var col = j;
        var rowspan = 1;
        while (i + rowspan < cells.Rows() &&
          cells.Get(i + rowspan, j) === undefined) {
          ++rowspan;
        }
        while (j + 1 < cells.Cols() && cells.IsUndefinedAbove(i, j + 1)) ++j;
        var colspan = j - col + 1;
        var th = $('<th>')
          .attr('colspan', colspan)
          .attr('rowspan', rowspan)
          .text(text)
          .appendTo(tr);
      }
      tr.appendTo(element);
    }
    return element;
  }

  function RenderDataChunk(schema, item, options) {
    options = options || {};
    var cells = new Array2D();
    var curCol = 0;
    var curRow = 0;
    var xs = [item];

    var element = $('<tbody>');
    if (options.collapsible) {
      var td = $('<td>');
      cells.Set(0, 0, td);
      element.collapser = td;
      ++curCol;
    }

    IterateSchema(
      schema,
      function(item) {
        var td = $('<td>');
        Format(item.format, td, xs[xs.length - 1][item.id]);
        cells.Set(curRow, curCol, td);
        ++curCol;
      },
      function(item) {
        xs.push(xs[xs.length - 1][item.id]);
      },
      function(item) {
        xs.pop();
      }
    );
    for (var i = 0; i < cells.Rows(); ++i) {
      var tr = $('<tr>');
      for (var j = 0; j < cells.Cols(); ++j) {
        if (cells.Get(i, j) === undefined) continue;
        var td = cells.Get(i, j);
        var col = j;
        var rowspan = 1;
        while (i + rowspan < cells.Rows() &&
          cells.Get(i + rowspan, j) === undefined) {
          ++rowspan;
        }
        while (j + 1 < cells.Cols() && cells.Get(i, j + 1) === undefined) ++j;
        var colspan = j - col + 1;
        td.attr('colspan', colspan)
          .attr('rowspan', rowspan)
          .appendTo(tr);
      }
      tr.appendTo(element);
    }
    element.colspanwidth = cells.Cols();
    return element;
  }

  function RenderFields(schema, data, title) {
    var el = $('<table>').addClass('deeptable');
    $('<th>').attr('colspan', 2).addClass('deeptable-title')
      .text(title).appendTo($('<tr>').appendTo(el));

    for (var i = 0; i < schema.length; ++i) {
      var tbody = $('<tbody>').addClass(i % 2 ? 'even' : 'odd').appendTo(el);
      var tr = $('<tr>').appendTo(tbody);
      $('<th>').text(schema[i].title).appendTo(tr);
      var td = $('<td>');
      if (schema[i].subfields) {
        var table = $('<table>').addClass('deeptable').appendTo(td);
        RenderHeader(schema[i].subfields).appendTo(table);
        RenderDataChunk(schema[i].subfields, data[schema[i].id])
          .addClass('odd')
          .appendTo(table);
      } else {
        Format(schema[i].format, td, data[schema[i].id]);
      }
      td.appendTo(tr);
    }

    return el;
  }

  $.widget('ui.deeptable', {
    defaultElement: '<div>',
    options: {
      schema: [],
      data: [],
      onClick: undefined,
    },
    _create: function() {
      var schema = this.options.schema;
      for (var i = 0; i < schema.order.length; ++i) {
        if (this.options.data[schema.order[i]]) {
          this.renderChunk(this.element, {},
            schema,
            schema.order[i],
            this.options.data[schema.order[i]]);
        }
      }
    },
    renderChunk: function(parent, parent_options, root_schema, section, data) {
      var schema = root_schema[section];
      var options = schema.options || {};
      options = $.extend({}, parent_options, options);
      if (schema.type == 'table') {
        var el = $('<table>').addClass('deeptable').appendTo(parent);
        RenderHeader(schema.columns, schema.title, options).appendTo(el);
        for (var i = 0; i < data.length; ++i) {
          var row = RenderDataChunk(schema.columns, data[i], options);
          row.addClass(i % 2 ? 'even' : 'odd').appendTo(el);
          if (schema.subsections) {
            var innerTbody = $('<tbody>').addClass('inner');
            var hasSomething = false;
            for (var j = 0; j < schema.subsections.length; ++j) {
              var subsection = schema.subsections[j];
              var d = data[i][subsection.id];
              if (!d || d.length == 0) continue;
              hasSomething = true;
              var td = $('<td>')
                .addClass('subsection')
                .attr('colspan', row.colspanwidth)
                .appendTo($('<tr>').appendTo(innerTbody));
              this.renderChunk(td, options, root_schema, subsection.schema, d);
            }
            if (hasSomething) {
              innerTbody.appendTo(el);
              if (row.collapser) {
                (function(collapser, tbody) {
                  tbody.hide();
                  var hidden = true;
                  collapser.text('⊞').addClass('clickable').click(function() {
                    if (hidden) {
                      tbody.show('fast');
                      collapser.text('⊟');
                      hidden = false;
                    } else {
                      tbody.hide();
                      collapser.text('⊞');
                      hidden = true;                      
                    }
                  });
                })(row.collapser, innerTbody);
              }
            }
          }
          if (options.clickable && this.options.onClick) {
            row.addClass('clickable');
            row.click(this.options.onClick.bind(this, data[i]));
          }
        }
      } else if (schema.type == 'fields') {
        RenderFields(schema.fields, data, schema.title)
          .appendTo(parent);
      } else {
        $('<div>').text('Uknown schema type! ' + schema.type).appendTo(parent);
      }
    }
  });

})(jQuery);
