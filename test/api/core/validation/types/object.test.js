const
  PreconditionError = require('kuzzle-common-objects').errors.PreconditionError,
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  ObjectType = require('../../../../../lib/api/core/validation/types/object'),
  should = require('should');

describe('Test: validation/types/object', () => {
  const objectType = new ObjectType();

  it('should inherit the BaseType class', () => {
    should(objectType).be.instanceOf(BaseType);
  });

  it('should construct properly', () => {
    should(typeof objectType.typeName).be.eql('string');
    should(typeof objectType.allowChildren).be.eql('boolean');
    should(Array.isArray(objectType.allowedTypeOptions)).be.true();
    should(objectType.typeName).be.eql('object');
    should(objectType.allowChildren).be.true();
  });

  describe('#validate', () => {
    it('should return true if the value is an object', () => {
      should(objectType.validate({}, {})).be.true();
    });

    it('should return false if the value is not an object', () => {
      [[], 'foobar', undefined, null, 123].forEach(v => {
        const errorMessages = [];

        should(objectType.validate({}, v, errorMessages)).be.false();
        should(errorMessages).be.deepEqual(['The value must be an object.']);
      });
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should throw if the strict option is not a boolean', () => {
      should(() => objectType.validateFieldSpecification({strict: 'not a boolean'}))
        .throw(PreconditionError, {message: 'Option "strict" must be of type "boolean"'});
    });

    it('should return the typeOptions object if it is valid', () => {
      const opts = {strict: false};

      should(objectType.validateFieldSpecification(opts)).be.eql(opts);
    });
  });

  describe('#getStrictness', () => {
    it('should return parentStrictness if strict is not defined in typeOptions', () => {
      should(objectType.getStrictness({}, true)).be.true();
    });

    it('should return parentStrictness if strict is not defined in typeOptions', () => {
      should(objectType.getStrictness({}, false)).be.false();
    });

    it('should return strict option if defined', () => {
      should(objectType.getStrictness({strict: true}, false)).be.true();
    });
  });
});
