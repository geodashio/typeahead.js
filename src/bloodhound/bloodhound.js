/*
 * typeahead.js
 * https://github.com/twitter/typeahead.js
 * Copyright 2013-2014 Twitter, Inc. and other contributors; Licensed MIT
 */

var Bloodhound = (function() {
  'use strict';

  var old;

  old = window && window.Bloodhound;

  // constructor
  // -----------

  function Bloodhound(o) {
    o = oParser(o);

    this.sorter = o.sorter;
    this.identify = o.identify;
    this.sufficient = o.sufficient;

    this.local = o.local;
    this.remote = o.remote ? new Remote(o.remote) : null;
    this.prefetch = o.prefetch ? new Prefetch(o.prefetch) : null;

    // the backing data structure used for fast pattern matching
    this.index = new SearchIndex({
      identify: this.identify,
      datumTokenizer: o.datumTokenizer,
      queryTokenizer: o.queryTokenizer
    });

    // hold off on intialization if the intialize option was explicitly false
    o.initialize !== false && this.initialize();
  }

  // static methods
  // --------------

  Bloodhound.noConflict = function noConflict() {
    window && (window.Bloodhound = old);
    return Bloodhound;
  };

  Bloodhound.tokenizers = tokenizers;

  // instance methods
  // ----------------

  _.mixin(Bloodhound.prototype, {

    // ### super secret stuff used for integration with jquery plugin

    __ttAdapter: function ttAdapter() {
      var that = this;

      return this.remote ? withAsync : withoutAsync;

      function withAsync(query, sync, async) {
        return that.search(query, sync, async);
      }

      function withoutAsync(query, sync) {
        return that.search(query, sync);
      }
    },

    // ### private

    _loadPrefetch: function loadPrefetch() {
      var that = this, deferred, serialized;

      deferred = $.Deferred();

      if (!this.prefetch) {
        deferred.resolve();
      }

      else if (serialized = this.prefetch.fromCache()) {
        this.index.bootstrap(serialized);
        deferred.resolve();
      }

      else {
        this.prefetch.fromNetwork(done);
      }

      return deferred.promise();

      function done(err, data) {
        if (err) { return deferred.reject(); }

        that.clear();
        that.add(data);
        that.prefetch.store(that.index.serialize());
        deferred.resolve();
      }
    },

    _initialize: function initialize() {
      var that = this, deferred;

      // in case this is a reinitialization, clear previous data
      this.clear();


       // local must be added to index after prefetch
      (this.initPromise = this._loadPrefetch()).done(function(){
        if(that.local.length > 0) // Only replace if local data is present
        {
          that.clear();
          that.add(that.local);
        }
      });

      return this.initPromise;


    },

    // ### public

    initialize: function initialize(force) {
      return !this.initPromise || force ? this._initialize() : this.initPromise;
    },

    // TODO: before initialize what happens?
    add: function add(data) {
      this.index.add(data);
      return this;
    },

    get: function get(ids) {
      ids = _.isArray(ids) ? ids : [].slice.call(arguments);
      return this.index.get(ids);
    },

    search: function search(query, sync, async, filters) {
      var that = this, local;
      var q2 = query;
      var queryFree = query.free || query;
      var filters2 = filters || [];

      local = query == "" ? $.map(this.sorter(this.index.datums), function(d, i){return d;}) : this.sorter(this.index.search(queryFree));

      // return a copy to guarantee no changes within this scope
      // as this array will get used when processing the remote results
      sync(this.remote ? local.slice() : local);

      if (this.remote && local.length < this.sufficient) {
        this.remote.get(queryFree, processRemote);
      }

      else if (this.remote) {
        // #149: prevents outdated rate-limited requests from being sent
        this.remote.cancelLastRequest();
      }

      return this;

      function processRemote(remote) {
        var nonDuplicates = [];

        // exclude duplicates
        _.each(remote, function(r) {
           !_.some(local, function(l) {
            return that.identify(r) === that.identify(l);
          }) && nonDuplicates.push(r);
        });

        that.clear();
        that.add(remote); // Adds to Search Index

        if(queryFree == "")
        {
          nonDuplicates = $.map(that.sorter(that.index.datums), function(d, i){return d;});
        }
        else
        {
          for(var i = 0; i < filters2.length; i++)
          {
            nonDuplicates = filters2[i](nonDuplicates, q2);
          }
          nonDuplicates = that.sorter(that.index.search(queryFree));
        }

        async && async(nonDuplicates);
      }
    },

    all: function all() {
      return this.index.all();
    },

    clear: function clear() {
      this.index.reset();
      return this;
    },

    clearPrefetchCache: function clearPrefetchCache() {
      this.prefetch && this.prefetch.clear();
      return this;
    },

    clearRemoteCache: function clearRemoteCache() {
      Transport.resetCache();
      return this;
    },

    // DEPRECATED: will be removed in v1
    ttAdapter: function ttAdapter() {
      return this.__ttAdapter();
    }
  });

  return Bloodhound;
})();
