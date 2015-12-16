var
  should = require('should'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError');

require('should-promised');

describe('Test: admin controller', function () {
  var
    kuzzle,
    requestObject = new RequestObject({ controller: 'admin' }, { collection: 'unit-test-adminController' }, 'unit-test');

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.repositories.role.validateAndSaveRole = role => {
          return Promise.resolve({
            _index: 'mainindex',
            _type: '%kuzzle/roles',
            _id: role._id,
            created: true
          });
        };

        done();
      });
  });

  it('should activate a hook on a delete collection call', function (done) {
    this.timeout(50);

    kuzzle.once('data:deleteCollection', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.deleteCollection(requestObject)
      .catch(function (error) {
        done(error);
      });
  });

  it('should activate a hook on a put mapping call', function (done) {
    this.timeout(50);

    kuzzle.once('data:putMapping', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.putMapping(requestObject)
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a mapping when requested', function () {
    var r = kuzzle.funnel.admin.getMapping(requestObject);
    return should(r).be.rejectedWith(NotFoundError, { message: 'No mapping for current index' });
  });

  it('should activate a hook on a get mapping call', function (done) {
    this.timeout(50);

    kuzzle.once('data:getMapping', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.getMapping(requestObject);
  });

  it('should trigger a hook on a getStats call', function (done) {
    this.timeout(50);

    kuzzle.once('data:getStats', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.getStats(requestObject);
  });

  it('should trigger a hook on a getLastStats call', function (done) {
    this.timeout(50);

    kuzzle.once('data:getLastStats', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.getLastStats(requestObject);
  });

  it('should trigger a hook on a getAllStats call', function (done) {
    this.timeout(50);

    kuzzle.once('data:getAllStats', function (obj) {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.getAllStats(requestObject);
  });

  it('should trigger a hook on a truncateCollection call', function (done) {
    this.timeout(50);

    kuzzle.once('data:truncateCollection', obj => {
      try {
        should(obj).be.exactly(requestObject);
        done();
      }
      catch (e) {
        done(e);
      }
    });

    kuzzle.funnel.admin.truncateCollection(requestObject);
  });

  it('should resolve to a responseObject on a putRole call', done => {
    kuzzle.funnel.admin.putRole(new RequestObject({
      body: { _id: 'test', indexes: {} }
    }))
      .then(result => {
        should(result).be.an.instanceOf(ResponseObject);
        should(result.data._id).be.exactly('test');
        should(result.data.body._id).be.exactly('test');
        done();
      })
      .catch(error => {
        done(error);
      });
  });

  describe('#removeRooms', function () {
    it('should trigger a plugin hook', function (done) {
      this.timeout(50);

      kuzzle.once('subscription:removeRooms', obj => {
        try {
          should(obj).be.exactly(requestObject);
          done();
        }
        catch (e) {
          done(e);
        }
      });

      kuzzle.funnel.admin.removeRooms(requestObject);
    });

    it('should resolve to a promise', function () {
      return should(kuzzle.funnel.admin.removeRooms(requestObject)).be.rejected();
    });
  });
});
