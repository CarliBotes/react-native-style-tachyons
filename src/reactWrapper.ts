import React from "react";
import _ from "lodash";
import cssColors from "css-color-names";
/* eslint-disable import/no-cycle */
import { styles, options } from "./index";
import { lhStyles } from "./styles/lineHeight";

/*
 * Wrap takes a Component or a render function and recursively replaces
 * the prop 'cls' (or custom overridden prop name) with the respective 'style' definitions.
 * Render functions are decorated so that when they are invoked the resulting
 * element tree will be be recursively evaluated and 'cls' will be replaced with
 * 'style' definitions.
 */
export default function wrap(componentOrFunction: any) {
    if (!(componentOrFunction.prototype && "render" in componentOrFunction.prototype)) {
        const func = componentOrFunction;

        return function wrappedRender(...args: any[]) {
            /* disable no-invalid-this */
            return recursiveStyle(func.apply(func, args));
        };
    }
    const WrappedComponent = componentOrFunction;
    const newClass = class extends WrappedComponent {
        render() {
            return recursiveStyle(super.render());
        }
    };

    /* Fix name */
    newClass.displayName = WrappedComponent.displayName || WrappedComponent.name;

    /* Mark the class as wrapped by tachyons */
    newClass.isTachyonsWrapped = true;

    return newClass;
}

function setStyles(props: any, clsPropName: any, typeScale: any) {
    const newProps: any = {};
    if (_.isArray(props.style)) {
        newProps.style = props.style.slice();
    } else if (_.isObject(props.style)) {
        newProps.style = [props.style];
    } else {
        newProps.style = [];
    }

    const splitted = props[clsPropName].replace(/-/gu, "_").split(" ");
    const fontSize = _.find(_.keys(typeScale), (fSetting) => _.includes(splitted, fSetting));

    for (let i = 0; i < splitted.length; i++) {
        const cls = splitted[i];
        if (cls.length > 0) {
            if (styles[cls]) {
                /* Style found */
                newProps.style.push(styles[cls]);
            } else if (cls.startsWith("lh_")) {
                /* Get font style */
                if (!_.isString(fontSize)) {
                    throw new Error(`setting '${cls}' needs explicit font-size`);
                }

                newProps.style.push({
                    lineHeight: lhStyles[cls.replace(/_/gu, "-")] * styles[fontSize].fontSize
                });
            } else if (cls.startsWith("bg_")) {
                newProps.style.push({
                    backgroundColor: cls.slice(3)
                });
            } else if (cls.startsWith("b__")) {
                newProps.style.push({
                    borderColor: cls.slice(3)
                });
            } else if (cls.startsWith("tint_")) {
                newProps.style.push({
                    tintColor: cls.slice(3)
                });
            } else if ((cssColors as any)[cls] || (/^(rgb|#|hsl)/u).test(cls)) {
                newProps.style.push({
                    color: cls
                });
            } else {
                throw new Error(`style '${cls}' not found`);
            }
        }
    }

    return newProps;
}

function recursiveStyle(elementsTree: any) {
    /*
     * If the node type is wrapped by tachyons then return immediately. This
     * will prevent unnecessarily applying styles to elements that have already
     * been wrapped.
     */
    if (elementsTree.type.isTachyonsWrapped) {
        return elementsTree;
    }

    const { props } = elementsTree;
    const { clsPropName, typeScale } = options;
    let newProps = null;
    let translated = false;

    /* Parse cls string */
    if (_.isString(props[clsPropName])) {
        translated = true;
        newProps = setStyles(props, clsPropName, typeScale);
    }

    let newChildren = props.children;
    if (_.isArray(newChildren)) {
    /* Convert child array */
        newChildren = React.Children.toArray(newChildren);
        for (let i = 0; i < newChildren.length; i++) {
            const c = newChildren[i];
            if (React.isValidElement(c)) {
                const converted = recursiveStyle(c);
                if (converted !== c) {
                    translated = true;
                    newChildren[i] = converted;
                }
            }
        }
    } else if (React.isValidElement(newChildren)) {
    /* Convert single child */
        const converted = recursiveStyle(newChildren);
        if (converted !== newChildren) {
            translated = true;
            newChildren = converted;
        }
    } else if (_.isFunction(newChildren)) {
    /* Convert a fumction child to evaluate on invocation */
        const originalChildrenFunction = newChildren;
        const converted = (...args: any[]) => recursiveStyle(originalChildrenFunction(...args));
        if (converted !== newChildren) {
            translated = true;
            newChildren = converted;
        }
    }

    if (translated) {
        return React.cloneElement(elementsTree, newProps, newChildren);
    }

    return elementsTree;
}
