const helpers = require('./helpers/helper'),
      getValuesHelper = require('./helpers/getValuesHelper'),
      request = require('request'),
      requestPromise = require('request-promise'),
      Promise = require('bluebird'),
      cheerio = require('cheerio');

'use strict';

/**
 * Initilizes object with its Project ID and Preview API Key that represents a Kentico Cloud project.
 * @constructor Delivery
 * @param {string} projectID Project ID, see details in the Kentico Cloud Developers Hub: https://developer.kenticocloud.com/docs/using-delivery-api#section-getting-project-id.
 * @param {string} previewKey Preview API Key, see details in the Kentico Cloud Developers Hub: https://developer.kenticocloud.com/docs/preview-content-via-api.
 * @example
 * var project = new Delivery('82594550-e25c-8219-aee9-677f600bad53', 'ew0KICAiYWxnIjo...QvV8puicXQ');
 */
class Delivery {
  constructor (projectID, previewKey) {
    this.projectID = projectID;
    this.previewKey = typeof previewKey === 'undefined' ? null : previewKey;
  }
};


/**
 * Returns promise with data specified by array of params.
 * @method getContent
 * @param {array} params Filtering url parameters that are used for requesting Kentico Cloud storage. See deatils about filtering url parameters: https://developer.kenticocloud.com/v1/reference#delivery-api
 * @param {boolean} isPreview Flag that controls whether only published or all items should be requested.
 * @return {promise} Returns promise with array of responses for each passed parameter from the Kentico Cloud storage.
 * @example
 * // returns [{items: [...]}, {items: [...]}]
 * project.getContent(['?system.type=navigation', '?system.type=homepage'], false)
 */
Delivery.prototype.getContent = function (params, isPreview) {
  var options = helpers.getFullDeliveryUrls(params, this.projectID, this.previewKey, isPreview);

  return Promise.map(options, (item) => {
    return requestPromise(item);
  });
};


/**
 * Returns object where each content item is assigned to one category according to their position in given arrays. Number of content items and categories must match.
 * @method categorizeContent
 * @param {array} content Content items returned from the "getContent" method.
 * @param {array} categories Names of categories.
 * @return {object} Returns object where content items are property values and categories are property names oreder by their position in given arrays.
 * @example
 * // returns {navigation: {items: [...]}, homepage: {items: [...]}}
 * project.getContent(['?system.type=navigation', '?system.type=homepage'], false)
 * .then((data) => {
 *   return project.categorizeContent(data, ['navigation', 'homepage']);
 * })
 */
Delivery.prototype.categorizeContent = (content, categories) => {
  if (content.length !== categories.length) {
    return Promise.reject('Number of content items and categories must be equal. Current number of content items is ' + content.length + '. Current number of categories is ' + categories.length + '.');
  }

  var categorizedContent = {};
  content.forEach((item, index) => {
    if (typeof categories[index] !== 'string') {
      return Promise.reject('Category must be a string. Category that in not a string is on index ' + index + ' and has value of ' + categories[index] + '.');
    }
    categorizedContent[categories[index]] = item;
  });

  return categorizedContent;
};


/**
 * Returns values from content items.
 * Covers content types: Text, Rich text, Number, Multiple choice, Date & time, Asset, Modular content, URL slug, Taxonomy and supports localization.
 * For Rich text elements the method covers: Modular content, images and links with value added as "Web URL". For links added as "Content item" the method returns a <a> tag with empty "href" attribute as it is not possible to identify full url from the Kentico Cloud response.
 * Data of a Modular content which is part of a Rich text element is returned as a <script> tag with data in the JSON format inside. The <script> tag is inserted after the <object> tag which represents position of the Modular content in the default Kentico CLoud response.
 * @method getValues
 * @param {object} content Categorized content items returned from the "categorizeContent" method.
 * @param {object} config Optional. Model that describes values you need to get from the data provided through content parameter. If the config parameter is not present the returned object contains the "system" object for each item and values for each property. It is recommeneded not to use the "config" parameter in most scenarions.
 * @return {object} Returns structured content items values.
 * @example
 * // Returns
 * // {
 * //   homepage: {
 * //     items: [{
 * //       system: {
 * //         id: '...',
 * //         name: '...'
 * //       },
 * //       elements: {
 * //         page_title: '...',
 * //         header: '...',
 * //         logos: [{
 * //           system: {
 * //             codename: '...'
 * //           },
 * //           elements: {
 * //             image: ['...'],
 * //             url: '...'
 * //           }
 * //         }]
 * //       }
 * //     }
 * //   }],
 * //   blog: {
 * //     items: [{
 * //       system: {
 * //         id: '...',
 * //         name: '...'
 * //       },
 * //       elements: {
 * //         page_title: '...',
 * //         publish_date: '...',
 * //         header_image: ['...', '...']
 * //       }
 * //     },{
 * //       system: {
 * //         id: '...',
 * //         name: '...'
 * //       },
 * //       elements: {
 * //         page_title: '...',
 * //         publish_date: '...',
 * //         header_image: ['...', '...']
 * //       }
 * //    }],
 * //    pagination: {
 * //      skip: ...,
 * //      limit: ...,
 * //      count: ...,
 * //      next_page: '...'
 * //    }
 * // }
 * project.getContent(['?system.type=home', '?system.type=blog_post'], false)
 * .then((data) => {
 *   return project.categorizeContent(data, ['hompage', 'blog']);
 * })
 * .then((data) => {
 *   return project.getValues(data, {
 *     homepage: {
 *       system: ['id', 'name'],
 *       elements: ['page_title', 'header', {
 *         name: 'logos',
 *         system: ['codename'],
 *         elements: ['image', 'url']
 *       }]
 *     },
 *     blog: {
 *       system: ['id', 'name'],
 *       elements: ['page_title', 'publish_date', 'header_image'],
 *       pagination: true
 *     }
 *   });
 * });
 */
Delivery.prototype.getValues = (content, config) => {

  /* This is a monster method that iterates through the whole response and transforms it according to given config */

  if (typeof content !== 'object') {
    return Promise.reject('Content must be a categorized object.');
  }

  if (typeof config === 'undefined') {
    return getValuesHelper.getValuesWithoutConfig(content);
  } else {
    if (helpers.isEmptyObject(config)) {
      return Promise.reject('Config must be provided.');
    }
    return getValuesHelper.getValuesWithConfig(content, config);
  }

};


/**
 * Returns data containing resolved specified Modular content in specified Rich text element.
 * @method resolveModularContentInRichText
 * @param {object} content
 * @param {string} categoryName
 * @param {string} elementName
 * @param {string} template
 * @param {string} modularContentCodeName
 * @return {object}
 * @example
 * project.getContent(['?system.type=home'], false)
 * .then((data) => {
 *   return project.categorizeContent(data, ['hompage']);
 * })
 * .then((data) => {
 *   return project.getValues(data, {
 *     homepage: {
 *       elements: ['rich_content_with_modular_content']
 *     }
 *   });
 * })
 * .then((data) => {
 *   data = project.resolveModularContentInRichText(data, 'homepage', 'rich_content_with_modular_content', 'myCodeName', '<div class="foo">{elements.label}</div><span>{system.id}</span>');
 *   return data;
* });
 */
Delivery.prototype.resolveModularContentInRichText = (content, categoryName, elementName, modularContentCodeName, template) => {
  var richTextContent = '';

  content[categoryName].items.forEach((item, index) => {
    if (typeof item.elements[elementName] !== 'undefined') {
      var $ = cheerio.load(item.elements[elementName]);
      var $object = $('object[data-codename="' + modularContentCodeName + '"]')
      var codename = $object.attr('data-codename');
      var data = JSON.parse($object.next('script#' + codename).html());

      var regex = /\{([^}]+)\}/gi;
      var result = [];
      var indices = [];

      while ((result = regex.exec(template)) ) {
        indices.push(result);

        var objectProperies = result[1].split('.');

        var tempData = data;
        objectProperies.forEach((itemProperties, indexProperties) => {
          tempData = tempData[itemProperties];
        });


        var resolvedString = '';
        if (objectProperies[0] === 'elements') {
          resolvedString = tempData.value;
        } else {
          resolvedString = tempData;
        }

        template = template.replace(result[0], resolvedString);
      }

      $object.next('script#' + codename).remove();
      $object.replaceWith(template);
      item.elements[elementName] = $.html().replace('<html><head></head><body>', '').replace('</body></html>', '');
    }
  });

  return content;
};

module.exports = Delivery;
