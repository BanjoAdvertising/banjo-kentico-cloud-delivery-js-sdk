var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var Delivery = require('../src/index');
var testObject = require('./testObject');

var expect = chai.expect;
var assert = chai.assert;
var should = chai.should;

chai.use(chaiAsPromised);
chai.should();

var project = new Delivery('28f9fefa-3686-402a-9379-88bcda2cbd13', 'ew0KICAiYWxnIjogIkhTMjU2IiwNCiAgInR5cCI6ICJKV1QiDQp9.ew0KICAidWlkIjogInVzcl8wdk9GSTkzSDAwQUlXNkwyUlJnZUNEIiwNCiAgImVtYWlsIjogIm1pbGFuLmthY3VyYWtAZ21haWwuY29tIiwNCiAgInByb2plY3RfaWQiOiAiMjhmOWZlZmEtMzY4Ni00MDJhLTkzNzktODhiY2RhMmNiZDEzIiwNCiAgImp0aSI6ICJOdHJiVmV4QkZ5Y3U5dGV4IiwNCiAgInZlciI6ICIxLjAuMCIsDQogICJnaXZlbl9uYW1lIjogIk1pbGFuIiwNCiAgImZhbWlseV9uYW1lIjogIkx1bmQiLA0KICAiYXVkIjogInByZXZpZXcuZGVsaXZlci5rZW50aWNvY2xvdWQuY29tIg0KfQ._FA1NJG4FQQXucinF8EnkQBiLRAIQMjB1yWFYAele0M');

describe('Delivery', function() {
  describe('#Initialization', function() {
    it('should init project details', function() {
      assert.equal(project.projectID, '28f9fefa-3686-402a-9379-88bcda2cbd13');
    });
  });

  describe('#getContent', function() {
    it('promise should be fulfilled with passed array', function() {
      return Promise.resolve(project.getContent(['?system.type=automated_test'])).should.eventually.fulfilled;
    });

    it('promise should be fulfilled with passed object', function() {
      return Promise.resolve(project.getContent({
        testItemsParent: '?system.type=automated_test',
        testItems: '?system.type=automated_test_item'
      })).should.eventually.fulfilled;
    });

    it('should get content items with passed array and check if there is 1 item', function() {
      return Promise.resolve(project.getContent(['?system.type=automated_test']).then(function(data) {return data[0].items})).should.eventually.have.length(1);
    });

    it('should get content items with passed object and check if there are 2 items', function() {
      return Promise.resolve(project.getContent({
        testItemsParent: '?system.type=automated_test',
        testItems: '?system.type=automated_test_item'
      }).then(function(data) {return Object.keys(data)})).should.eventually.have.length(2);
    });

    it('should get content items with passed object and check if testItemsParent.items is array', function() {
      return Promise.resolve(project.getContent({
        testItemsParent: '?system.type=automated_test',
        testItems: '?system.type=automated_test_item'
      }).then(function(data) {return data.testItemsParent.items})).should.eventually.be.a('array');
    });

    it('should get only published content items with passed object and check if testItems has 4 items', function() {
      return Promise.resolve(project.getContent({
        testItemsParent: '?system.type=automated_test',
        testItems: '?system.type=automated_test_item'
      }).then(function(data) {return data.testItems.items})).should.eventually.have.length(4);
    });

    it('should get published and draft content items with passed object and check if testItems has 5 items', function() {
      return Promise.resolve(project.getContent({
        testItemsParent: '?system.type=automated_test',
        testItems: '?system.type=automated_test_item'
      }, true).then(function(data) {return data.testItems.items})).should.eventually.have.length(5);
    });
  });

  describe('#categorizeContent', function() {
    it('should categorize response and check if testItemsParent.items is array', function() {
      return Promise.resolve(project.getContent(['?system.type=automated_test', '?system.type=automated_test_item']))
      .then(function(data) {return project.categorizeContent(data, ['testItemsParent', 'testItems']);})
      .then(function(data) {return data.testItemsParent.items}).should.eventually.be.a('array');
    });
  });

  describe('#getValues without config', function() {
    var data = project.getValues(testObject);

    it('its categories should have "items" and "pagination" keys', function() {
      expect(data.testItemsParent).to.have.all.keys('items', 'pagination');
    });

    it('its categories should not be "modular_content" key', function() {
      expect(data.testItemsParent).to.not.have.all.keys('modular_content');
    });

    it('its items should have "system" and "elements" keys', function() {
      expect(data.testItemsParent.items[0]).to.have.all.keys('system', 'elements');
    });

    it('its elements should not have "type" or "name" keys', function() {
      expect(data.testItemsParent.items[0].elements.rich_text).to.not.have.any.keys('type', 'name');
    });
  });

  describe('#getValues with config', function() {
    var data = project.getValues(testObject, {
      testItemsParent: {
        system: ['id'],
        elements: ['rich_text', {
          name: 'modular_content',
           system: ['codename'],
           elements: ['text']
         }]
       }
     });

    it('its categories should have "items" key', function() {
      expect(data.testItemsParent).to.have.all.keys('items');
    });

    it('its categories should not be "modular_content" key', function() {
      expect(data.testItemsParent).to.not.have.all.keys('modular_content');
    });

    it('its items should have "system" and "elements" keys', function() {
      expect(data.testItemsParent.items[0]).to.have.all.keys('system', 'elements');
    });

    it('its system should have only "id" key', function() {
      expect(data.testItemsParent.items[0].system).to.have.all.keys('id');
    });

    it('its elements should not have "type" or "name" keys', function() {
      expect(data.testItemsParent.items[0].elements.rich_text).to.not.have.any.keys('type', 'name');
    });

    it('its modular_content[0].system.codename should be string', function() {
      expect(data.testItemsParent.items[0].elements.modular_content[0].system.codename).to.be.a('string');
    });
  });

  describe('#resolveModularContentInRichText', function() {
    var data = project.getValues(testObject);
    data = project.resolveModularContentInRichText(data, 'testItemsParent', 'rich_text', 'automated_test_item', '<span class="resolved">{elements.text}</span>')

    it('should return resolver rich_text with string "<span class="resolved">Morbi scelerisque luctus velit.</span>"', function() {
      expect(data.testItemsParent.items[0].elements.rich_text).to.have.string('<span class="resolved">Morbi scelerisque luctus velit.</span>');
    });
  });
});
