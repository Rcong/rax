/**
 * Web Browser driver
 **/

/* global DEVICE_WIDTH, VIEWPORT_WIDTH */

import { convertUnit, setRem } from 'style-unit';
import flexbox from './flexbox';
import { PROPERTY_WHITE_LIST, isReserved, shouldSetNullValue, getPropertyDetail } from './propertiesConfig';

const DANGEROUSLY_SET_INNER_HTML = 'dangerouslySetInnerHTML';
const CLASS_NAME = 'className';
const CLASS = 'class';
const STYLE = 'style';
const CHILDREN = 'children';
const EVENT_PREFIX_REGEXP = /on[A-Z]/;

const ADD_EVENT = 'addEvent';
const REMOVE_EVENT = 'removeEvent';

const Driver = {

  deviceWidth: typeof DEVICE_WIDTH !== 'undefined' && DEVICE_WIDTH || null,
  viewportWidth: typeof VIEWPORT_WIDTH !== 'undefined' && VIEWPORT_WIDTH || 750,
  eventRegistry: {},

  getDeviceWidth() {
    return this.deviceWidth || document.documentElement.clientWidth;
  },

  setDeviceWidth(width) {
    this.deviceWidth = width;
  },

  getViewportWidth() {
    return this.viewportWidth;
  },

  setViewportWidth(width) {
    this.viewportWidth = width;
  },

  getElementById(id) {
    return document.getElementById(id);
  },

  createBody() {
    return document.body;
  },

  createComment(content) {
    return document.createComment(content);
  },

  createEmpty() {
    return this.createComment(' empty ');
  },

  createText(text) {
    return document.createTextNode(text);
  },

  updateText(node, text) {
    let textContentAttr = 'textContent' in document ? 'textContent' : 'nodeValue';
    node[textContentAttr] = text;
  },

  createElement(component) {
    let node = document.createElement(component.type);
    let props = component.props;

    this.setNativeProps(node, props);

    return node;
  },

  appendChild(node, parent) {
    return parent.appendChild(node);
  },

  removeChild(node, parent) {
    parent = parent || node.parentNode;
    // Maybe has been removed when remove child
    if (parent) {
      parent.removeChild(node);
    }
  },

  replaceChild(newChild, oldChild, parent) {
    parent = parent || oldChild.parentNode;
    parent.replaceChild(newChild, oldChild);
  },

  insertAfter(node, after, parent) {
    parent = parent || after.parentNode;
    const nextSibling = after.nextSibling;
    if (nextSibling) {
      parent.insertBefore(node, nextSibling);
    } else {
      parent.appendChild(node);
    }
  },

  insertBefore(node, before, parent) {
    parent = parent || before.parentNode;
    parent.insertBefore(node, before);
  },

  addEventListener(node, eventName, eventHandler, props) {
    if (this.eventRegistry[eventName]) {
      return this.eventRegistry[eventName](ADD_EVENT, node, eventName, eventHandler, props);
    } else {
      return node.addEventListener(eventName, eventHandler);
    }
  },

  removeEventListener(node, eventName, eventHandler, props) {
    if (this.eventRegistry[eventName]) {
      return this.eventRegistry[eventName](REMOVE_EVENT, node, eventName, eventHandler, props);
    } else {
      return node.removeEventListener(eventName, eventHandler);
    }
  },

  removeAllEventListeners(node) {
    // noop
  },

  removeAttribute(node, propKey) {
    if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      return node.innerHTML = null;
    }

    if (propKey === CLASS_NAME) {
      propKey = CLASS;
    }

    if (propKey in node) {
      try {
        // Some node property is readonly when in strict mode
        node[propKey] = null;
      } catch (e) { }
    }

    node.removeAttribute(propKey);
  },

  setAttribute(node, propKey, propValue) {
    const propertyDetail = getPropertyDetail(propKey);

    if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      // in case propValue is not a plain object
      node.innerHTML = ({ ...propValue }).__html || null;
    } else if (propertyDetail && this.shouldSetAttribute(propKey, propValue)) {
      // delete property value from node
      if (shouldSetNullValue(propKey, propValue)) {
        this.removeProperty(node, propKey);
      } else if (propertyDetail.mustUseProperty) {
        this.setProperty(node, propertyDetail.propertyName, propValue)
      } else {
        this.setDOMAttribute(node, propertyDetail.attributeName, propValue)
      }

      if (propKey === 'value') {
        // value has some special place
        this.mutateValue(node, propValue);
      }

    } else {
      propValue = this.shouldSetAttribute(propKey, propValue) ? propValue : null;
      this.setDOMAttribute(node, propKey, propValue);
    }
  },

  // special for value
  mutateValue(node, propValue) {
    if (propValue == null) {
      return node.removeAttribute('value');
    }

    // Number inputs get special treatment due to some edge cases in
    // Chrome. Let everything else assign the value attribute as normal.
    // https://github.com/facebook/react/issues/7253#issuecomment-236074326
    if (node.type !== 'number' || node.hasAttribute('value') === false) {
      node.setAttribute('value', '' + propValue);
    } else if (
      node.validity &&
      !node.validity.badInput &&
      node.ownerDocument.activeElement !== node
    ) {
      // Don't assign an attribute if validation reports bad
      // input. Chrome will clear the value. Additionally, don't
      // operate on inputs that have focus, otherwise Chrome might
      // strip off trailing decimal places and cause the user's
      // cursor position to jump to the beginning of the input.
      //
      // In ReactDOMInput, we have an onBlur event that will trigger
      // this function again when focus is lost.
      node.setAttribute('value', '' + propValue);
    }
  },

  setDOMAttribute(node, propKey, propValue) {
    const propertyDetail = getPropertyDetail(propKey);
    if (propValue == null) {
      node.removeAttribute(name);
    } else {
      const attributeName = propertyDetail.attributeName;
      // `setAttribute` with objects becomes only `[object]` in IE8/9,
      // ('' + propValue) makes it output the correct toString()-value.
      if (
        propertyDetail.hasBooleanValue ||
        (propertyDetail.hasOverloadedBooleanValue && propValue === true)
      ) {
        // if attributeName is `required`, it becomes `<input required />`
        node.setAttribute(attributeName, '');
      } else {
        node.setAttribute(attributeName, '' + propValue);
      }
    }
  },

  removeProperty(node, propKey) {
    const propertyDetail = getPropertyDetail(propKey);
    if (propertyDetail) {
      if (propertyDetail.mustUseProperty) {
        if (propertyDetail.hasBooleanValue) {
          node[propKey] = false;
        } else {
          node[propKey] = '';
        }
      } else {
        node.removeAttribute(propertyDetail.attributeName);
      }
    } else {
      node.removeAttribute(propKey);
    }
  },

  setProperty(node, propKey, propValue) {
    // Contrary to `setAttribute`, object properties are properly
    // `toString`ed by IE8/9.
    node[propKey] = propValue;
  },

  // check whether a property name is a writeable attribute
  shouldSetAttribute(propKey, propValue) {
    // some reserved props ignored
    if (isReserved(propKey)) {
      return false;
    }

    if (propValue === null) {
      return true;
    }
    const propertyDetail = getPropertyDetail(propKey);

    switch (typeof propValue) {
      case 'boolean':
        // that not null means propValue in white list
        if (propertyDetail) {
          return true;
        }
        // data- and aria- pass
        const prefix = lowerCased.slice(0, 5);
        return prefix === 'data-' || prefix === 'aria-';
      case 'undefined':
      case 'number':
      case 'string':
        return true;
      case 'object':
        return true;
      default:
        // function, symbol, and others
        return false;
    }
  },

  setStyles(node, styles) {
    let tranformedStyles = {};

    for (let prop in styles) {
      let val = styles[prop];
      if (flexbox.isFlexProp(prop)) {
        flexbox[prop](val, tranformedStyles);
      } else {
        tranformedStyles[prop] = convertUnit(val, prop);
      }
    }

    for (let prop in tranformedStyles) {
      const transformValue = tranformedStyles[prop];
      // hack handle compatibility issue
      if (Array.isArray(transformValue)) {
        for (let i = 0; i < transformValue.length; i++) {
          node.style[prop] = transformValue[i];
        }
      } else {
        node.style[prop] = transformValue;
      }
    }
  },

  beforeRender() {
    // Init rem unit
    setRem(this.getDeviceWidth() / this.getViewportWidth());
  },

  setNativeProps(node, props) {
    for (let prop in props) {
      let value = props[prop];
      if (prop === CHILDREN) {
        continue;
      }

      if (value != null) {
        if (prop === STYLE) {
          this.setStyles(node, value);
        } else if (EVENT_PREFIX_REGEXP.test(prop)) {
          let eventName = prop.slice(2).toLowerCase();
          this.addEventListener(node, eventName, value);
        } else {
          this.setAttribute(node, prop, value);
        }
      }
    }
  }
};

export default Driver;
