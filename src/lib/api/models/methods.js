var
  _ = require('lodash'),
  async = require('async'),
  operators = require('./operators'),
  q = require('q');

module.exports = {

  /**
   * Build rooms and filtersTree according to a given filter for 'term' filter (test equality)
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  term: function (filtersTree, roomId, collection, filter, not) {
    return termFunction('term', filtersTree, roomId, collection, filter, not);
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'terms' filter (test equality with one of given value in array)
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  terms: function (filtersTree, roomId, collection, filter, not) {
    return termFunction('terms', filtersTree, roomId, collection, filter, not);
  },

  /**
   * Build filtersTree according to a given filter for 'range' filter and return the formatted filter
   * that can contains filters: gte, gt, lte, lt, from, to
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  range: function (filtersTree, roomId, collection, filter, not) {
    var
      deferred = q.defer(),
      field,
      formattedFilters;

    if (_.isEmpty(filter)) {
      deferred.reject('A filter can\'t be empty');
      return deferred.promise;
    }

    field = Object.keys(filter)[0];
    formattedFilters = {};

    async.each(Object.keys(filter[field]), function (fn, callback) {
      var
        value = filter[field][fn],
        curriedFunctionName = '';

      if (not) {
        curriedFunctionName += 'not';
      }
      curriedFunctionName += 'range' + field + fn + value;

      var result = buildCurriedFunction(filtersTree, collection, field, fn, value, curriedFunctionName, roomId, not);
      if (result.error) {
        callback(result.error);
        return false;
      }

      formattedFilters[result.path] = result.filter;

      callback();
    }, function (error) {
      if (error) {
        deferred.reject(error);
      }

      deferred.resolve({and : formattedFilters});
    });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'bool' filter (nested filters with ~and/or)
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  bool: function (filtersTree, roomId, collection, filter, not) {
    var
      deferred = q.defer(),
      allowedBoolFunctions = ['must', 'mustNot', 'should'],
      formattedFilters;

    if (_.isEmpty(filter)) {
      deferred.reject('A filter can\'t be empty');
      return deferred.promise;
    }

    formattedFilters = {};

    async.each(Object.keys(filter), function (method, callback) {
      var methodName = _.camelCase(method);
      if (this[methodName] === undefined || allowedBoolFunctions.indexOf(methodName) === -1) {
        callback('Function ' + method + ' doesn\'t exist');
      }

      this[methodName](filtersTree, roomId, collection, filter[method], not)
        .then(function (subFormattedFilters) {
          formattedFilters = deepExtend(formattedFilters, subFormattedFilters);
          callback();
        })
        .catch(function (error) {
          callback(error);
        });

    }.bind(this), function (error) {
      if (error) {
        deferred.reject(error);
      }

      // check if there is an upper "and" that wrap the whole object
      if ((Object.keys(formattedFilters)[0] !== 'or' && Object.keys(formattedFilters)[0] !== 'and') ||
          Object.keys(formattedFilters).length > 1) {

        formattedFilters = { and: formattedFilters };
      }

      deferred.resolve(formattedFilters);
    });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'must' filter (and in nested filters)
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  must: function (filtersTree, roomId, collection, filters, not) {
    var deferred = q.defer();

    getFormattedFilters.bind(this)(filtersTree, roomId, collection, filters, not)
      .then(function (formattedFilters) {
        deferred.resolve({and: formattedFilters});
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'must_not' filter (and not in nested filters)
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  mustNot: function (filtersTree, roomId, collection, filters, not) {
    if (not === undefined) {
      not = false;
    }

    return this.must(filtersTree, roomId, collection, filters, !not);
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'should' filter (or in nested filters with a minimum should match option)
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  should: function (filtersTree, roomId, collection, filters, not) {
    var deferred = q.defer();

    getFormattedFilters.bind(this)(filtersTree, roomId, collection, filters, not)
      .then(function (formattedFilters) {
        if (not) {
          deferred.resolve({and: formattedFilters});
        }
        else {
          deferred.resolve({or: formattedFilters});
        }
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'and' filter
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  and: function (filtersTree, roomId, collection, filters, not) {
    var deferred = q.defer();

    getFormattedFilters.bind(this)(filtersTree, roomId, collection, filters, not)
      .then(function (formattedFilters) {
        deferred.resolve({and: formattedFilters});
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'or' filter
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  or: function (filtersTree, roomId, collection, filters, not) {
    var deferred = q.defer();

    getFormattedFilters.bind(this)(filtersTree, roomId, collection, filters, not)
      .then(function (formattedFilters) {
        deferred.resolve({or: formattedFilters});
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'not' filter
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  not: function (filtersTree, roomId, collection, filters, not) {
    if (not === undefined) {
      not = false;
    }

    return this.must(filtersTree, roomId, collection, filters, !not);
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'exists' filter
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  exists: function (filtersTree, roomId, collection, filter, not) {
    var
      deferred = q.defer(),
      fieldName,
      formattedFilters,
      curriedFunctionName = '';

    if (_.isEmpty(filter)) {
      deferred.reject('A filter can\'t be empty');
      return deferred.promise;
    }

    fieldName = filter.field;

    if (!fieldName) {
      deferred.reject('Filter \'exists\' must contains \'field\' attribute');
      return deferred.promise;
    }

    formattedFilters = {};

    if (not) {
      curriedFunctionName += 'not';
    }
    // Clean the field in function name because can contains '.' and we don't want it in the function name
    curriedFunctionName += 'exists' + fieldName.split('.').join('');

    var result = buildCurriedFunction(filtersTree, collection, fieldName, 'exists', fieldName, curriedFunctionName, roomId, not);
    if (result.error) {
      deferred.reject(result.error);
      return deferred.promise;
    }

    formattedFilters[result.path] = result.filter;

    deferred.resolve(formattedFilters);
    return deferred.promise;
  },

  /**
   * Return true only if the point in field is in the bounding box
   */
  geoBoundingBox: function () {

  },

  /**
   * Return true only if the point in field is in a specific distance from a geo point
   */
  geoDistance: function () {

  },

  /**
   * Return true only if the point in field is in a range from a specific point
   */
  geoDistanceRange: function () {

  },

  /**
   * Return true only if the point in field is in a polygon of points
   */
  geoPolygon: function () {

  },

  /**
   * Return true only if the point in field is in the square
   */
  geoShape: function() {

  },

  /**
   * Return true only if the value in field pass the regexp test
   */
  regexp: function () {

  }
};


/**
 * Fill object filtersTree with the new filter added by user
 *
 * @param {Object} filtersTree global object defined in hotelClerckController
 * @param {String} collection the collection name
 * @param {String} field the field where we need to apply the filter
 * @param {String} operatorName the operator name that the user wants to execute against the document (defined in operator.js)
 * @param {*} value the value to test on the field
 * @param {String} curriedFunctionName
 * @param {String} roomId
 * @param {Boolean} not
 * @returns {Object} an object with the path and the new filter
 */
var buildCurriedFunction = function (filtersTree, collection, field, operatorName, value, curriedFunctionName, roomId, not) {
  if (operators[operatorName] === undefined) {
    return {error: 'Operator ' + operatorName + ' doesn\'t exist'};
  }

  var
    curriedFunction,
    path = collection+'.'+field+'.'+curriedFunctionName;


  if (!filtersTree[collection]) {
    filtersTree[collection] = {};
  }

  if (!filtersTree[collection][field]) {
    filtersTree[collection][field] = {};
  }

  if (!filtersTree[collection][field][curriedFunctionName]) {
    curriedFunction  = _.curry(operators[operatorName]);
    curriedFunction = _.curry(curriedFunction(field, value));
    if (not) {
      curriedFunction = _.negate(curriedFunction);
    }

    filtersTree[collection][field][curriedFunctionName] = {
      rooms: [],
      fn: curriedFunction
    };
  }

  filtersTree[collection][field][curriedFunctionName].rooms.push(roomId);

  return {
    path: path,
    filter: filtersTree[collection][field][curriedFunctionName]
  };
};

/**
 * Construct the formattedFilters for filters with conditional operand (bool, and, or, ...)
 *
 * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
 * @param {String} roomId
 * @param {String} collection
 * @param {Object} filters given by user on subscribe
 * @param {Boolean} not if not is true, invert the boolean result
 * @return {Promise} the formatted filter that need to be added to the room
 */
var getFormattedFilters = function (filtersTree, roomId, collection, filters, not) {
  var
    deferred = q.defer(),
    formattedFilters;

  if (_.isEmpty(filters)) {
    deferred.reject('Filters can\'t be empty');
    return deferred.promise;
  }

  formattedFilters = {};

  if (!Array.isArray(filters)) {
    filters = [filters];
  }

  async.each(filters, function (filter, callback) {
    var
      method = Object.keys(filter)[0],
      methodName = _.camelCase(method);

    if (_.isEmpty(filter)) {
      // just ignore if one of filters is empty, we don't have to rise an error
      return false;
    }

    if (this[methodName] === undefined) {
      callback('Function ' + method + ' doesn\'t exist');
      return false;
    }

    this[methodName](filtersTree, roomId, collection, filter[method], not)
      .then(function (subFormattedFilters) {
        formattedFilters = _.extend(formattedFilters, subFormattedFilters);
        callback();
      })
      .catch(function (error) {
        callback(error);
      });

  }.bind(this), function (error) {
    if (error) {
      deferred.reject(error);
    }

    deferred.resolve(formattedFilters);
  });

  return deferred.promise;
};

/**
 * Allow to merge two object and merge extend entries "and" and "or"
 * @param {Object} filters1
 * @param {Object} filters2
 * @returns {Object} the merged object
 */
var deepExtend = function (filters1, filters2) {

  if (_.isEmpty(filters1)) {
    return filters2;
  }
  if (_.isEmpty(filters2)) {
    return filters1;
  }

  var
    attr,
    resultFilters = _.clone(filters1);

  for (attr in filters2) {
    if (!resultFilters[attr]) {
      resultFilters[attr] = filters2[attr];
    }
    else {
      if ( attr === 'and' || attr === 'or' ) {
        resultFilters[attr] = deepExtend(resultFilters[attr], filters2[attr]);
      }
    }
  }

  return resultFilters;
};

/**
 * Allow to build filter for "term" and "terms" filters
 *
 * @param {String} termType "term" or "terms"
 * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
 * @param {String} roomId
 * @param {String} collection
 * @param {Object} filter given by user on subscribe
 * @param {Boolean} not if not is true, check if filters are not true
 * @return {Promise} the formatted filter that need to be added to the room
 */
var termFunction = function (termType, filtersTree, roomId, collection, filter, not) {
  var
    deferred = q.defer(),
    field,
    value,
    formattedFilters,
    curriedFunctionName = '';

  if (_.isEmpty(filter)) {
    deferred.reject('A filter can\'t be empty');
    return deferred.promise;
  }

  field = Object.keys(filter)[0];
  value = filter[field];
  formattedFilters = {};

  if (termType === 'terms' && !Array.isArray(value)) {
    deferred.reject('Filter terms must contains an array');
    return deferred.promise;
  }

  if (not) {
    curriedFunctionName += 'not';
  }
  // Clean the field in function name because can contains '.' and we don't want it in the function name
  curriedFunctionName += termType + field.split('.').join('') + value;

  var result = buildCurriedFunction(filtersTree, collection, field, termType, value, curriedFunctionName, roomId, not);
  if (result.error) {
    deferred.reject(result.error);
    return deferred.promise;
  }

  formattedFilters[result.path] = result.filter;

  deferred.resolve(formattedFilters);
  return deferred.promise;
};