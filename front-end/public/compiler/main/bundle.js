(function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.31.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* front-end/src/compiler/message/message.svelte generated by Svelte v3.31.2 */

    const file = "front-end/src/compiler/message/message.svelte";

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-lj9k1j-style";
    	style.textContent = ".svelte-lj9k1j.svelte-lj9k1j{transition:all 0.6s;font-size:5vw !important}#main.svelte-lj9k1j.svelte-lj9k1j{width:100%;margin-top:20vw;text-align:center}.fof.svelte-lj9k1j.svelte-lj9k1j{display:table-cell;vertical-align:middle}.fof.svelte-lj9k1j h1.svelte-lj9k1j{font-size:50px;display:inline-block;padding-right:12px;animation:svelte-lj9k1j-type 0.5s alternate infinite}@keyframes svelte-lj9k1j-type{from{box-shadow:inset -3px 0px 0px #888}to{box-shadow:inset -3px 0px 0px transparent}}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZS5zdmVsdGUiLCJzb3VyY2VzIjpbIm1lc3NhZ2Uuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQgbGFuZz1cInRzXCI+Ly9AdHMtaWdub3JlXG5leHBvcnQgbGV0IG1lc3NhZ2UgPSBnbG9iYWxEYXRhLm1lc3NhZ2U7XG48L3NjcmlwdD5cclxuXHJcbjxtYWluPlxyXG4gICAgPGRpdiBpZD1cIm1haW5cIj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiZm9mXCI+XHJcbiAgICAgICAgICAgIDxoMT57bWVzc2FnZX08L2gxPlxyXG4gICAgICAgICAgICA8YSBocmVmPVwiXCI+IGdvIEJhY2s/PC9hPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgPC9kaXY+XHJcbjwvbWFpbj5cclxuXHJcbjxzdHlsZT5cclxuICAgICoge1xyXG4gICAgICAgIHRyYW5zaXRpb246IGFsbCAwLjZzO1xyXG4gICAgICAgIGZvbnQtc2l6ZTogNXZ3ICFpbXBvcnRhbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgaHRtbCB7XHJcbiAgICAgICAgaGVpZ2h0OiAxMDAlO1xyXG4gICAgfVxyXG5cclxuICAgIGJvZHkge1xyXG4gICAgICAgIGZvbnQtZmFtaWx5OiBcIkxhdG9cIiwgc2Fucy1zZXJpZjtcclxuICAgICAgICBjb2xvcjogIzg4ODtcclxuICAgICAgICBtYXJnaW46IDA7XHJcbiAgICB9XHJcblxyXG4gICAgI21haW4ge1xyXG4gICAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICAgIG1hcmdpbi10b3A6IDIwdnc7XHJcbiAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgfVxyXG5cclxuICAgIC5mb2Yge1xyXG4gICAgICAgIGRpc3BsYXk6IHRhYmxlLWNlbGw7XHJcbiAgICAgICAgdmVydGljYWwtYWxpZ246IG1pZGRsZTtcclxuICAgIH1cclxuXHJcbiAgICAuZm9mIGgxIHtcclxuICAgICAgICBmb250LXNpemU6IDUwcHg7XHJcbiAgICAgICAgZGlzcGxheTogaW5saW5lLWJsb2NrO1xyXG4gICAgICAgIHBhZGRpbmctcmlnaHQ6IDEycHg7XHJcbiAgICAgICAgYW5pbWF0aW9uOiB0eXBlIDAuNXMgYWx0ZXJuYXRlIGluZmluaXRlO1xyXG4gICAgfVxyXG5cclxuICAgIEBrZXlmcmFtZXMgdHlwZSB7XHJcbiAgICAgICAgZnJvbSB7XHJcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IGluc2V0IC0zcHggMHB4IDBweCAjODg4O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdG8ge1xyXG4gICAgICAgICAgICBib3gtc2hhZG93OiBpbnNldCAtM3B4IDBweCAwcHggdHJhbnNwYXJlbnQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG48L3N0eWxlPlxyXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBY0ksNEJBQUUsQ0FBQyxBQUNDLFVBQVUsQ0FBRSxHQUFHLENBQUMsSUFBSSxDQUNwQixTQUFTLENBQUUsR0FBRyxDQUFDLFVBQVUsQUFDN0IsQ0FBQyxBQVlELEtBQUssNEJBQUMsQ0FBQyxBQUNILEtBQUssQ0FBRSxJQUFJLENBQ1gsVUFBVSxDQUFFLElBQUksQ0FDaEIsVUFBVSxDQUFFLE1BQU0sQUFDdEIsQ0FBQyxBQUVELElBQUksNEJBQUMsQ0FBQyxBQUNGLE9BQU8sQ0FBRSxVQUFVLENBQ25CLGNBQWMsQ0FBRSxNQUFNLEFBQzFCLENBQUMsQUFFRCxrQkFBSSxDQUFDLEVBQUUsY0FBQyxDQUFDLEFBQ0wsU0FBUyxDQUFFLElBQUksQ0FDZixPQUFPLENBQUUsWUFBWSxDQUNyQixhQUFhLENBQUUsSUFBSSxDQUNuQixTQUFTLENBQUUsa0JBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQUFDM0MsQ0FBQyxBQUVELFdBQVcsa0JBQUssQ0FBQyxBQUNiLElBQUksQUFBQyxDQUFDLEFBQ0YsVUFBVSxDQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEFBQ3ZDLENBQUMsQUFFRCxFQUFFLEFBQUMsQ0FBQyxBQUNBLFVBQVUsQ0FBRSxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsV0FBVyxBQUM5QyxDQUFDLEFBQ0wsQ0FBQyJ9 */";
    	append_dev(document.head, style);
    }

    function create_fragment(ctx) {
    	let main;
    	let div1;
    	let div0;
    	let h1;
    	let t0;
    	let t1;
    	let a;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text(/*message*/ ctx[0]);
    			t1 = space();
    			a = element("a");
    			a.textContent = "go Back?";
    			attr_dev(h1, "class", "svelte-lj9k1j");
    			add_location(h1, file, 7, 12, 153);
    			attr_dev(a, "href", "");
    			attr_dev(a, "class", "svelte-lj9k1j");
    			add_location(a, file, 8, 12, 185);
    			attr_dev(div0, "class", "fof svelte-lj9k1j");
    			add_location(div0, file, 6, 8, 122);
    			attr_dev(div1, "id", "main");
    			attr_dev(div1, "class", "svelte-lj9k1j");
    			add_location(div1, file, 5, 4, 97);
    			attr_dev(main, "class", "svelte-lj9k1j");
    			add_location(main, file, 4, 0, 85);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div1);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    			append_dev(h1, t0);
    			append_dev(div0, t1);
    			append_dev(div0, a);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*message*/ 1) set_data_dev(t0, /*message*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Message", slots, []);
    	let { message = globalData.message } = $$props;
    	const writable_props = ["message"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Message> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("message" in $$props) $$invalidate(0, message = $$props.message);
    	};

    	$$self.$capture_state = () => ({ message });

    	$$self.$inject_state = $$props => {
    		if ("message" in $$props) $$invalidate(0, message = $$props.message);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [message];
    }

    class Message extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-lj9k1j-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, { message: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Message",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get message() {
    		throw new Error("<Message>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set message(value) {
    		throw new Error("<Message>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* front-end/src/compiler/main/components/finished_page.svelte generated by Svelte v3.31.2 */

    const file$1 = "front-end/src/compiler/main/components/finished_page.svelte";

    function add_css$1() {
    	var style = element("style");
    	style.id = "svelte-lhzmns-style";
    	style.textContent = ".svelte-lhzmns{transition:all 0.4s;font-size:7vh}#text2.svelte-lhzmns{font-size:5vh}#text3.svelte-lhzmns,a.svelte-lhzmns{font-size:4vh}#main.svelte-lhzmns{width:100%;margin-top:20vw;text-align:center}@keyframes svelte-lhzmns-type{from{box-shadow:inset -3px 0px 0px #888}to{box-shadow:inset -3px 0px 0px transparent}}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluaXNoZWRfcGFnZS5zdmVsdGUiLCJzb3VyY2VzIjpbImZpbmlzaGVkX3BhZ2Uuc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQgbGFuZz1cInRzXCI+ZXhwb3J0IGxldCB1cmwgPSBcIlwiO1xud2luZG93LmxvY2F0aW9uLmhyZWYgPSB1cmw7XG48L3NjcmlwdD5cclxuXHJcbjxkaXYgaWQ9XCJtYWluXCIgY2xhc3M9XCJmb2ZcIj5cclxuICAgIDxkaXYgaWQ9XCJ0ZXh0XCI+RmluaXNoZWQgY29tcGlsaW5nITwvZGl2PlxyXG4gICAgPGRpdiBpZD1cInRleHQyXCI+WW91ciBkb3dubG9hZCB3aWxsIHN0YXJ0IHNvb24uLjwvZGl2PlxyXG4gICAgPGRpdiBpZD1cInRleHQzXCI+XHJcbiAgICAgICAgSW5jYXNlIGl0IGRpZG4ndCwgY2xpY2sgPGEgaHJlZj17dXJsfT5oZXJlPC9hPlxyXG4gICAgPC9kaXY+XHJcbiAgICA8YnIgLz5cclxuICAgIDxhIGhyZWY9XCJcIj4gZ28gQmFjaz88L2E+XHJcbjwvZGl2PlxyXG5cclxuPHN0eWxlPlxyXG4gICAgKiB7XHJcbiAgICAgICAgdHJhbnNpdGlvbjogYWxsIDAuNHM7XHJcbiAgICAgICAgZm9udC1zaXplOiA3dmg7XHJcbiAgICB9XHJcblxyXG4gICAgI3RleHQyIHtcclxuICAgICAgICBmb250LXNpemU6IDV2aDtcclxuICAgIH1cclxuICAgICN0ZXh0MyxcclxuICAgIGEge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogNHZoO1xyXG4gICAgfVxyXG5cclxuICAgICNtYWluIHtcclxuICAgICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgICBtYXJnaW4tdG9wOiAyMHZ3O1xyXG4gICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgIH1cclxuICAgIEBrZXlmcmFtZXMgdHlwZSB7XHJcbiAgICAgICAgZnJvbSB7XHJcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IGluc2V0IC0zcHggMHB4IDBweCAjODg4O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdG8ge1xyXG4gICAgICAgICAgICBib3gtc2hhZG93OiBpbnNldCAtM3B4IDBweCAwcHggdHJhbnNwYXJlbnQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG48L3N0eWxlPlxyXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBZUksY0FBRSxDQUFDLEFBQ0MsVUFBVSxDQUFFLEdBQUcsQ0FBQyxJQUFJLENBQ3BCLFNBQVMsQ0FBRSxHQUFHLEFBQ2xCLENBQUMsQUFFRCxNQUFNLGNBQUMsQ0FBQyxBQUNKLFNBQVMsQ0FBRSxHQUFHLEFBQ2xCLENBQUMsQUFDRCxvQkFBTSxDQUNOLENBQUMsY0FBQyxDQUFDLEFBQ0MsU0FBUyxDQUFFLEdBQUcsQUFDbEIsQ0FBQyxBQUVELEtBQUssY0FBQyxDQUFDLEFBQ0gsS0FBSyxDQUFFLElBQUksQ0FDWCxVQUFVLENBQUUsSUFBSSxDQUNoQixVQUFVLENBQUUsTUFBTSxBQUN0QixDQUFDLEFBQ0QsV0FBVyxrQkFBSyxDQUFDLEFBQ2IsSUFBSSxBQUFDLENBQUMsQUFDRixVQUFVLENBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQUFDdkMsQ0FBQyxBQUVELEVBQUUsQUFBQyxDQUFDLEFBQ0EsVUFBVSxDQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEFBQzlDLENBQUMsQUFDTCxDQUFDIn0= */";
    	append_dev(document.head, style);
    }

    function create_fragment$1(ctx) {
    	let div3;
    	let div0;
    	let t1;
    	let div1;
    	let t3;
    	let div2;
    	let t4;
    	let a0;
    	let t5;
    	let t6;
    	let br;
    	let t7;
    	let a1;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			div0.textContent = "Finished compiling!";
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "Your download will start soon..";
    			t3 = space();
    			div2 = element("div");
    			t4 = text("Incase it didn't, click ");
    			a0 = element("a");
    			t5 = text("here");
    			t6 = space();
    			br = element("br");
    			t7 = space();
    			a1 = element("a");
    			a1.textContent = "go Back?";
    			attr_dev(div0, "id", "text");
    			attr_dev(div0, "class", "svelte-lhzmns");
    			add_location(div0, file$1, 5, 4, 113);
    			attr_dev(div1, "id", "text2");
    			attr_dev(div1, "class", "svelte-lhzmns");
    			add_location(div1, file$1, 6, 4, 159);
    			attr_dev(a0, "href", /*url*/ ctx[0]);
    			attr_dev(a0, "class", "svelte-lhzmns");
    			add_location(a0, file$1, 8, 32, 268);
    			attr_dev(div2, "id", "text3");
    			attr_dev(div2, "class", "svelte-lhzmns");
    			add_location(div2, file$1, 7, 4, 218);
    			attr_dev(br, "class", "svelte-lhzmns");
    			add_location(br, file$1, 10, 4, 308);
    			attr_dev(a1, "href", "");
    			attr_dev(a1, "class", "svelte-lhzmns");
    			add_location(a1, file$1, 11, 4, 320);
    			attr_dev(div3, "id", "main");
    			attr_dev(div3, "class", "fof svelte-lhzmns");
    			add_location(div3, file$1, 4, 0, 80);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div3, t1);
    			append_dev(div3, div1);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div2, t4);
    			append_dev(div2, a0);
    			append_dev(a0, t5);
    			append_dev(div3, t6);
    			append_dev(div3, br);
    			append_dev(div3, t7);
    			append_dev(div3, a1);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*url*/ 1) {
    				attr_dev(a0, "href", /*url*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Finished_page", slots, []);
    	let { url = "" } = $$props;
    	window.location.href = url;
    	const writable_props = ["url"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Finished_page> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("url" in $$props) $$invalidate(0, url = $$props.url);
    	};

    	$$self.$capture_state = () => ({ url });

    	$$self.$inject_state = $$props => {
    		if ("url" in $$props) $$invalidate(0, url = $$props.url);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [url];
    }

    class Finished_page extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-lhzmns-style")) add_css$1();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { url: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Finished_page",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get url() {
    		throw new Error("<Finished_page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<Finished_page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* front-end/src/compiler/main/components/loading_page.svelte generated by Svelte v3.31.2 */

    const file$2 = "front-end/src/compiler/main/components/loading_page.svelte";

    function add_css$2() {
    	var style = element("style");
    	style.id = "svelte-nns5qu-style";
    	style.textContent = ".svelte-nns5qu{transition:all 0.4s;font-size:7vw}#main.svelte-nns5qu{display:table;width:100%;margin-top:20vw;text-align:center}.fof.svelte-nns5qu{height:100%;vertical-align:middle;font-size:50px;display:inline-block;padding-right:12px;animation:svelte-nns5qu-type 0.5s alternate infinite}@keyframes svelte-nns5qu-type{from{box-shadow:inset -3px 0px 0px #888}to{box-shadow:inset -3px 0px 0px transparent}}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZGluZ19wYWdlLnN2ZWx0ZSIsInNvdXJjZXMiOlsibG9hZGluZ19wYWdlLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0IGxhbmc9XCJ0c1wiPjwvc2NyaXB0PlxyXG5cclxuPGRpdiBpZD1cIm1haW5cIiBjbGFzcz1cImZvZlwiPlxyXG4gICAgPGgxIGlkPVwidGV4dFwiPkluIFByb2dyZXNzLi48L2gxPlxyXG48L2Rpdj5cclxuXHJcbjxzdHlsZT5cclxuICAgICoge1xyXG4gICAgICAgIHRyYW5zaXRpb246IGFsbCAwLjRzO1xyXG4gICAgICAgIGZvbnQtc2l6ZTogN3Z3O1xyXG4gICAgfVxyXG5cclxuICAgICNtYWluIHtcclxuICAgICAgICBkaXNwbGF5OiB0YWJsZTtcclxuICAgICAgICB3aWR0aDogMTAwJTtcclxuICAgICAgICBtYXJnaW4tdG9wOiAyMHZ3O1xyXG4gICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgIH1cclxuICAgIC5mb2Yge1xyXG4gICAgICAgIGhlaWdodDogMTAwJTtcclxuICAgICAgICB2ZXJ0aWNhbC1hbGlnbjogbWlkZGxlO1xyXG4gICAgICAgIGZvbnQtc2l6ZTogNTBweDtcclxuICAgICAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XHJcbiAgICAgICAgcGFkZGluZy1yaWdodDogMTJweDtcclxuICAgICAgICBhbmltYXRpb246IHR5cGUgMC41cyBhbHRlcm5hdGUgaW5maW5pdGU7XHJcbiAgICB9XHJcblxyXG4gICAgQGtleWZyYW1lcyB0eXBlIHtcclxuICAgICAgICBmcm9tIHtcclxuICAgICAgICAgICAgYm94LXNoYWRvdzogaW5zZXQgLTNweCAwcHggMHB4ICM4ODg7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0byB7XHJcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IGluc2V0IC0zcHggMHB4IDBweCB0cmFuc3BhcmVudDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbjwvc3R5bGU+XHJcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFPSSxjQUFFLENBQUMsQUFDQyxVQUFVLENBQUUsR0FBRyxDQUFDLElBQUksQ0FDcEIsU0FBUyxDQUFFLEdBQUcsQUFDbEIsQ0FBQyxBQUVELEtBQUssY0FBQyxDQUFDLEFBQ0gsT0FBTyxDQUFFLEtBQUssQ0FDZCxLQUFLLENBQUUsSUFBSSxDQUNYLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLFVBQVUsQ0FBRSxNQUFNLEFBQ3RCLENBQUMsQUFDRCxJQUFJLGNBQUMsQ0FBQyxBQUNGLE1BQU0sQ0FBRSxJQUFJLENBQ1osY0FBYyxDQUFFLE1BQU0sQ0FDdEIsU0FBUyxDQUFFLElBQUksQ0FDZixPQUFPLENBQUUsWUFBWSxDQUNyQixhQUFhLENBQUUsSUFBSSxDQUNuQixTQUFTLENBQUUsa0JBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQUFDM0MsQ0FBQyxBQUVELFdBQVcsa0JBQUssQ0FBQyxBQUNiLElBQUksQUFBQyxDQUFDLEFBQ0YsVUFBVSxDQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEFBQ3ZDLENBQUMsQUFFRCxFQUFFLEFBQUMsQ0FBQyxBQUNBLFVBQVUsQ0FBRSxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsV0FBVyxBQUM5QyxDQUFDLEFBQ0wsQ0FBQyJ9 */";
    	append_dev(document.head, style);
    }

    function create_fragment$2(ctx) {
    	let div;
    	let h1;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "In Progress..";
    			attr_dev(h1, "id", "text");
    			attr_dev(h1, "class", "svelte-nns5qu");
    			add_location(h1, file$2, 3, 4, 64);
    			attr_dev(div, "id", "main");
    			attr_dev(div, "class", "fof svelte-nns5qu");
    			add_location(div, file$2, 2, 0, 31);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Loading_page", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Loading_page> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Loading_page extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-nns5qu-style")) add_css$2();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Loading_page",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    function getDefaultExportFromCjs (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    		path: basedir,
    		exports: {},
    		require: function (path, base) {
    			return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    		}
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var strictUriEncode = str => encodeURIComponent(str).replace(/[!'()*]/g, x => `%${x.charCodeAt(0).toString(16).toUpperCase()}`);

    var token = '%[a-f0-9]{2}';
    var singleMatcher = new RegExp(token, 'gi');
    var multiMatcher = new RegExp('(' + token + ')+', 'gi');

    function decodeComponents(components, split) {
    	try {
    		// Try to decode the entire string first
    		return decodeURIComponent(components.join(''));
    	} catch (err) {
    		// Do nothing
    	}

    	if (components.length === 1) {
    		return components;
    	}

    	split = split || 1;

    	// Split the array in 2 parts
    	var left = components.slice(0, split);
    	var right = components.slice(split);

    	return Array.prototype.concat.call([], decodeComponents(left), decodeComponents(right));
    }

    function decode(input) {
    	try {
    		return decodeURIComponent(input);
    	} catch (err) {
    		var tokens = input.match(singleMatcher);

    		for (var i = 1; i < tokens.length; i++) {
    			input = decodeComponents(tokens, i).join('');

    			tokens = input.match(singleMatcher);
    		}

    		return input;
    	}
    }

    function customDecodeURIComponent(input) {
    	// Keep track of all the replacements and prefill the map with the `BOM`
    	var replaceMap = {
    		'%FE%FF': '\uFFFD\uFFFD',
    		'%FF%FE': '\uFFFD\uFFFD'
    	};

    	var match = multiMatcher.exec(input);
    	while (match) {
    		try {
    			// Decode as big chunks as possible
    			replaceMap[match[0]] = decodeURIComponent(match[0]);
    		} catch (err) {
    			var result = decode(match[0]);

    			if (result !== match[0]) {
    				replaceMap[match[0]] = result;
    			}
    		}

    		match = multiMatcher.exec(input);
    	}

    	// Add `%C2` at the end of the map to make sure it does not replace the combinator before everything else
    	replaceMap['%C2'] = '\uFFFD';

    	var entries = Object.keys(replaceMap);

    	for (var i = 0; i < entries.length; i++) {
    		// Replace all decoded components
    		var key = entries[i];
    		input = input.replace(new RegExp(key, 'g'), replaceMap[key]);
    	}

    	return input;
    }

    var decodeUriComponent = function (encodedURI) {
    	if (typeof encodedURI !== 'string') {
    		throw new TypeError('Expected `encodedURI` to be of type `string`, got `' + typeof encodedURI + '`');
    	}

    	try {
    		encodedURI = encodedURI.replace(/\+/g, ' ');

    		// Try the built in decoder first
    		return decodeURIComponent(encodedURI);
    	} catch (err) {
    		// Fallback to a more advanced decoder
    		return customDecodeURIComponent(encodedURI);
    	}
    };

    var splitOnFirst = (string, separator) => {
    	if (!(typeof string === 'string' && typeof separator === 'string')) {
    		throw new TypeError('Expected the arguments to be of type `string`');
    	}

    	if (separator === '') {
    		return [string];
    	}

    	const separatorIndex = string.indexOf(separator);

    	if (separatorIndex === -1) {
    		return [string];
    	}

    	return [
    		string.slice(0, separatorIndex),
    		string.slice(separatorIndex + separator.length)
    	];
    };

    var queryString = createCommonjsModule(function (module, exports) {




    const isNullOrUndefined = value => value === null || value === undefined;

    function encoderForArrayFormat(options) {
    	switch (options.arrayFormat) {
    		case 'index':
    			return key => (result, value) => {
    				const index = result.length;

    				if (
    					value === undefined ||
    					(options.skipNull && value === null) ||
    					(options.skipEmptyString && value === '')
    				) {
    					return result;
    				}

    				if (value === null) {
    					return [...result, [encode(key, options), '[', index, ']'].join('')];
    				}

    				return [
    					...result,
    					[encode(key, options), '[', encode(index, options), ']=', encode(value, options)].join('')
    				];
    			};

    		case 'bracket':
    			return key => (result, value) => {
    				if (
    					value === undefined ||
    					(options.skipNull && value === null) ||
    					(options.skipEmptyString && value === '')
    				) {
    					return result;
    				}

    				if (value === null) {
    					return [...result, [encode(key, options), '[]'].join('')];
    				}

    				return [...result, [encode(key, options), '[]=', encode(value, options)].join('')];
    			};

    		case 'comma':
    		case 'separator':
    			return key => (result, value) => {
    				if (value === null || value === undefined || value.length === 0) {
    					return result;
    				}

    				if (result.length === 0) {
    					return [[encode(key, options), '=', encode(value, options)].join('')];
    				}

    				return [[result, encode(value, options)].join(options.arrayFormatSeparator)];
    			};

    		default:
    			return key => (result, value) => {
    				if (
    					value === undefined ||
    					(options.skipNull && value === null) ||
    					(options.skipEmptyString && value === '')
    				) {
    					return result;
    				}

    				if (value === null) {
    					return [...result, encode(key, options)];
    				}

    				return [...result, [encode(key, options), '=', encode(value, options)].join('')];
    			};
    	}
    }

    function parserForArrayFormat(options) {
    	let result;

    	switch (options.arrayFormat) {
    		case 'index':
    			return (key, value, accumulator) => {
    				result = /\[(\d*)\]$/.exec(key);

    				key = key.replace(/\[\d*\]$/, '');

    				if (!result) {
    					accumulator[key] = value;
    					return;
    				}

    				if (accumulator[key] === undefined) {
    					accumulator[key] = {};
    				}

    				accumulator[key][result[1]] = value;
    			};

    		case 'bracket':
    			return (key, value, accumulator) => {
    				result = /(\[\])$/.exec(key);
    				key = key.replace(/\[\]$/, '');

    				if (!result) {
    					accumulator[key] = value;
    					return;
    				}

    				if (accumulator[key] === undefined) {
    					accumulator[key] = [value];
    					return;
    				}

    				accumulator[key] = [].concat(accumulator[key], value);
    			};

    		case 'comma':
    		case 'separator':
    			return (key, value, accumulator) => {
    				const isArray = typeof value === 'string' && value.includes(options.arrayFormatSeparator);
    				const isEncodedArray = (typeof value === 'string' && !isArray && decode(value, options).includes(options.arrayFormatSeparator));
    				value = isEncodedArray ? decode(value, options) : value;
    				const newValue = isArray || isEncodedArray ? value.split(options.arrayFormatSeparator).map(item => decode(item, options)) : value === null ? value : decode(value, options);
    				accumulator[key] = newValue;
    			};

    		default:
    			return (key, value, accumulator) => {
    				if (accumulator[key] === undefined) {
    					accumulator[key] = value;
    					return;
    				}

    				accumulator[key] = [].concat(accumulator[key], value);
    			};
    	}
    }

    function validateArrayFormatSeparator(value) {
    	if (typeof value !== 'string' || value.length !== 1) {
    		throw new TypeError('arrayFormatSeparator must be single character string');
    	}
    }

    function encode(value, options) {
    	if (options.encode) {
    		return options.strict ? strictUriEncode(value) : encodeURIComponent(value);
    	}

    	return value;
    }

    function decode(value, options) {
    	if (options.decode) {
    		return decodeUriComponent(value);
    	}

    	return value;
    }

    function keysSorter(input) {
    	if (Array.isArray(input)) {
    		return input.sort();
    	}

    	if (typeof input === 'object') {
    		return keysSorter(Object.keys(input))
    			.sort((a, b) => Number(a) - Number(b))
    			.map(key => input[key]);
    	}

    	return input;
    }

    function removeHash(input) {
    	const hashStart = input.indexOf('#');
    	if (hashStart !== -1) {
    		input = input.slice(0, hashStart);
    	}

    	return input;
    }

    function getHash(url) {
    	let hash = '';
    	const hashStart = url.indexOf('#');
    	if (hashStart !== -1) {
    		hash = url.slice(hashStart);
    	}

    	return hash;
    }

    function extract(input) {
    	input = removeHash(input);
    	const queryStart = input.indexOf('?');
    	if (queryStart === -1) {
    		return '';
    	}

    	return input.slice(queryStart + 1);
    }

    function parseValue(value, options) {
    	if (options.parseNumbers && !Number.isNaN(Number(value)) && (typeof value === 'string' && value.trim() !== '')) {
    		value = Number(value);
    	} else if (options.parseBooleans && value !== null && (value.toLowerCase() === 'true' || value.toLowerCase() === 'false')) {
    		value = value.toLowerCase() === 'true';
    	}

    	return value;
    }

    function parse(query, options) {
    	options = Object.assign({
    		decode: true,
    		sort: true,
    		arrayFormat: 'none',
    		arrayFormatSeparator: ',',
    		parseNumbers: false,
    		parseBooleans: false
    	}, options);

    	validateArrayFormatSeparator(options.arrayFormatSeparator);

    	const formatter = parserForArrayFormat(options);

    	// Create an object with no prototype
    	const ret = Object.create(null);

    	if (typeof query !== 'string') {
    		return ret;
    	}

    	query = query.trim().replace(/^[?#&]/, '');

    	if (!query) {
    		return ret;
    	}

    	for (const param of query.split('&')) {
    		let [key, value] = splitOnFirst(options.decode ? param.replace(/\+/g, ' ') : param, '=');

    		// Missing `=` should be `null`:
    		// http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
    		value = value === undefined ? null : ['comma', 'separator'].includes(options.arrayFormat) ? value : decode(value, options);
    		formatter(decode(key, options), value, ret);
    	}

    	for (const key of Object.keys(ret)) {
    		const value = ret[key];
    		if (typeof value === 'object' && value !== null) {
    			for (const k of Object.keys(value)) {
    				value[k] = parseValue(value[k], options);
    			}
    		} else {
    			ret[key] = parseValue(value, options);
    		}
    	}

    	if (options.sort === false) {
    		return ret;
    	}

    	return (options.sort === true ? Object.keys(ret).sort() : Object.keys(ret).sort(options.sort)).reduce((result, key) => {
    		const value = ret[key];
    		if (Boolean(value) && typeof value === 'object' && !Array.isArray(value)) {
    			// Sort object keys, not values
    			result[key] = keysSorter(value);
    		} else {
    			result[key] = value;
    		}

    		return result;
    	}, Object.create(null));
    }

    exports.extract = extract;
    exports.parse = parse;

    exports.stringify = (object, options) => {
    	if (!object) {
    		return '';
    	}

    	options = Object.assign({
    		encode: true,
    		strict: true,
    		arrayFormat: 'none',
    		arrayFormatSeparator: ','
    	}, options);

    	validateArrayFormatSeparator(options.arrayFormatSeparator);

    	const shouldFilter = key => (
    		(options.skipNull && isNullOrUndefined(object[key])) ||
    		(options.skipEmptyString && object[key] === '')
    	);

    	const formatter = encoderForArrayFormat(options);

    	const objectCopy = {};

    	for (const key of Object.keys(object)) {
    		if (!shouldFilter(key)) {
    			objectCopy[key] = object[key];
    		}
    	}

    	const keys = Object.keys(objectCopy);

    	if (options.sort !== false) {
    		keys.sort(options.sort);
    	}

    	return keys.map(key => {
    		const value = object[key];

    		if (value === undefined) {
    			return '';
    		}

    		if (value === null) {
    			return encode(key, options);
    		}

    		if (Array.isArray(value)) {
    			return value
    				.reduce(formatter(key), [])
    				.join('&');
    		}

    		return encode(key, options) + '=' + encode(value, options);
    	}).filter(x => x.length > 0).join('&');
    };

    exports.parseUrl = (url, options) => {
    	options = Object.assign({
    		decode: true
    	}, options);

    	const [url_, hash] = splitOnFirst(url, '#');

    	return Object.assign(
    		{
    			url: url_.split('?')[0] || '',
    			query: parse(extract(url), options)
    		},
    		options && options.parseFragmentIdentifier && hash ? {fragmentIdentifier: decode(hash, options)} : {}
    	);
    };

    exports.stringifyUrl = (object, options) => {
    	options = Object.assign({
    		encode: true,
    		strict: true
    	}, options);

    	const url = removeHash(object.url).split('?')[0] || '';
    	const queryFromUrl = exports.extract(object.url);
    	const parsedQueryFromUrl = exports.parse(queryFromUrl, {sort: false});

    	const query = Object.assign(parsedQueryFromUrl, object.query);
    	let queryString = exports.stringify(query, options);
    	if (queryString) {
    		queryString = `?${queryString}`;
    	}

    	let hash = getHash(object.url);
    	if (object.fragmentIdentifier) {
    		hash = `#${encode(object.fragmentIdentifier, options)}`;
    	}

    	return `${url}${queryString}${hash}`;
    };
    });

    var lib = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.triggerEvent = exports.ObjTolocation = exports.locationToObj = exports.ParamsHandler = exports.QParamer = void 0;

    /** this is the class that is gonna make your life 1% easier, if you're into classes
     * @param window is the window from your virtual dom
    */
    var QParamer = /** @class */ (function () {
        function QParamer(window) {
            var _this = this;
            this.window = window;
            this._params = {};
            this.specialGetter = function () {
                return decodeURIComponent(_this.window.location.search);
            };
            this.specialSetter = function (newSet) {
                _this.window.history.pushState('page2', 'Title', newSet);
            };
        }
        QParamer.prototype.triggerListener = function (el, k) {
            triggerEvent(this.window.document, this.window.document, el);
        };
        Object.defineProperty(QParamer.prototype, "params", {
            get: function () {
                this._params = locationToObj(this.specialGetter());
                return this._params;
            },
            set: function (np) {
                console.error("You can't set this value, its readonly.. caon't you read??");
                console.info("We might add this feature in the future.");
            },
            enumerable: false,
            configurable: true
        });
        /** this function setts a variable to a value
         * @param name is the name of the variable
         * @param value is the new value for the variable
         * @returns null
        */
        QParamer.prototype.set = function (name, value) {
            this._params = locationToObj(this.specialGetter());
            this._params[name] = encodeURIComponent(value);
            this.specialSetter(ObjTolocation(this._params));
            // trigger specific
            this.triggerListener("searchLocationspecific_" + name, value);
            // trigger all
            this.triggerListener("searchLocationChanged", value);
        };
        /** this function gets a variable value
         * @param name is the name of the variable that you wanna get its value
         */
        QParamer.prototype.get = function (name) {
            return locationToObj(this.specialGetter())[name];
        };
        /** this function checks if a variable exists
         * @param name the name of the variable that you wanna check if it exists
        */
        QParamer.prototype.exists = function (name) {
            return locationToObj(this.specialGetter())[name] != undefined;
        };
        /** this function for event listeners
         * @param event - can be "change" - when the whole query changes or when a specific one changes
         * @param a - can be the callback function or the name of the variable that you wanna watch
         * @param b - optional can be the callback if a is the name of the variable and not a cb
         */
        QParamer.prototype.on = function (event, a, b) {
            var _this = this;
            switch (event) {
                case "change":
                    if (typeof a == typeof "string") {
                        this.window.document.addEventListener("searchLocationspecific_" + a, function () { return b(_this.params[a], _this); }, false);
                    }
                    else {
                        this.window.document.addEventListener("searchLocationChanged", function () { return a(_this.params, _this); }, false);
                    }
                    break;
                default:
                    console.error("the event that you specified doens't exists");
                    break;
            }
        };
        return QParamer;
    }());
    exports.QParamer = QParamer;
    /** this will create the object
     * @param window is the window from your virtual dom
     */
    function ParamsHandler(window) {
        var params = {};
        var triggerListener = function (el, k) {
            triggerEvent(window.document, window.document, el);
        };
        var specialGetter = function () {
            return decodeURIComponent(window.location.search);
        };
        var specialSetter = function (newSet) {
            window.history.pushState('page2', 'Title', newSet);
        };
        var init = {
            get params() {
                params = locationToObj(specialGetter());
                return params;
            },
            set params(np) {
                console.error("You can't set this value, its readonly.. caon't you read??");
                console.info("We might add this feature in the future.");
            },
            set: function (name, value) {
                params = locationToObj(specialGetter());
                params[name] = encodeURIComponent(value);
                specialSetter(ObjTolocation(params));
                // trigger specific
                triggerListener("searchLocationspecific_" + name);
                // trigger all
                triggerListener("searchLocationChanged");
            },
            get: function (name) {
                return locationToObj(specialGetter())[name];
            },
            exists: function (name) {
                return locationToObj(specialGetter())[name] != undefined;
            },
            on: function (event, a, b) {
                switch (event) {
                    case "change":
                        if (typeof a == typeof "string") {
                            window.document.addEventListener("searchLocationspecific_" + a, function () { return b(init.get(a), init); }, false);
                        }
                        else {
                            window.document.addEventListener("searchLocationChanged", function () { return a(init.params, init); }, false);
                        }
                        break;
                    default:
                        console.error("the event that you specified doens't exists");
                        break;
                }
            }
        };
        return init;
    }
    exports.ParamsHandler = ParamsHandler;
    function locationToObj(searchstr) {
        return queryString.parse(searchstr);
    }
    exports.locationToObj = locationToObj;
    function ObjTolocation(obj) {
        var arr = [];
        Object.keys(obj).forEach(function (key) {
            arr.push(encodeURIComponent(key) + "=" + encodeURIComponent(obj[key]));
        });
        return "?" + arr.join("&");
    }
    exports.ObjTolocation = ObjTolocation;
    function triggerEvent(document, el, type) {
        // IE9+ and other modern browsers
        if ('createEvent' in document) {
            var e = document.createEvent('HTMLEvents');
            e.initEvent(type, false, true);
            el.dispatchEvent(e);
        }
    }
    exports.triggerEvent = triggerEvent;
    });

    var pdh = /*@__PURE__*/getDefaultExportFromCjs(lib);

    /* front-end/src/compiler/main/components/submiting_page.svelte generated by Svelte v3.31.2 */

    const { Object: Object_1, console: console_1 } = globals;
    const file$3 = "front-end/src/compiler/main/components/submiting_page.svelte";

    function add_css$3() {
    	var style = element("style");
    	style.id = "svelte-1b9ng65-style";
    	style.textContent = ".svelte-1b9ng65{transition:all 0.4s;font-size:5vw}#main.svelte-1b9ng65{padding:5vw;position:fixed;width:100%;height:100%;text-align:center;border:10vh dashed #c3d3d8}.highlight.svelte-1b9ng65{color:white;border:10vh solid rgb(251, 244, 244) !important;background:#4dd5ff}@keyframes svelte-1b9ng65-type{from{box-shadow:inset -3px 0px 0px #888}to{box-shadow:inset -3px 0px 0px transparent}}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VibWl0aW5nX3BhZ2Uuc3ZlbHRlIiwic291cmNlcyI6WyJzdWJtaXRpbmdfcGFnZS5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdCBsYW5nPVwidHNcIj52YXIgX19hd2FpdGVyID0gKHRoaXMgJiYgdGhpcy5fX2F3YWl0ZXIpIHx8IGZ1bmN0aW9uICh0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xuICAgIH0pO1xufTtcbmltcG9ydCBwZGggZnJvbSBcInBhcmFtLWhhbmRsZXJcIjtcbmV4cG9ydCBsZXQgZG93bmxvYWRUaGVGaWxlO1xuZXhwb3J0IGxldCBlcnJvck1lc3NhZ2U7XG5leHBvcnQgbGV0IHZtb2Q7XG5sZXQgZGlyZWN0U3VibWl0dGluZyA9IGZhbHNlLCBoaWdobGlnaHRlZCA9IGZhbHNlLCB0eXBlc1Zpc2libGUgPSB0cnVlLCBzdWJtaXRCVE5WaXNpYmxlID0gdHJ1ZSwgaW5wdXRWaXNpYmxlID0gZmFsc2U7XG5jb25zdCBwaCA9IG5ldyBwZGguUVBhcmFtZXIod2luZG93KTtcbmNvbnN0IHBhcmFtQ2hlY2tlciA9IChwcm0sIG91ZCwgcmV2ZXJzZSA9IGZhbHNlKSA9PiB7XG4gICAgcmV0dXJuIHBybSA9PT0gdW5kZWZpbmVkXG4gICAgICAgID8gb3VkXG4gICAgICAgIDogcHJtID09PSBudWxsIHx8IHBybVxuICAgICAgICAgICAgPyAhcmV2ZXJzZVxuICAgICAgICAgICAgOiByZXZlcnNlO1xufTtcbmxldCBtYWludHlwZSA9IHBhcmFtQ2hlY2tlcihwaC5nZXQoXCJ0eXBlXCIpLCAwKTtcbmNvbnNvbGUubG9nKHR5cGVzVmlzaWJsZSwgcGguZ2V0KFwiaGlkZXR5cGVzXCIpKTtcbnR5cGVzVmlzaWJsZSA9IHBhcmFtQ2hlY2tlcihwaC5nZXQoXCJoaWRldHlwZXNcIiksIHR5cGVzVmlzaWJsZSwgdHJ1ZSk7XG5pbnB1dFZpc2libGUgPSAhcGFyYW1DaGVja2VyKHBoLmdldChcImhpZGVpbnB1dFwiKSwgaW5wdXRWaXNpYmxlLCB0cnVlKTtcbmxldCBzZWxlY3RlZFR5cGUgPSBtYWludHlwZTtcbmlmIChwYXJhbUNoZWNrZXIocGguZ2V0KFwiaGlkZWlucHV0XCIpLCBmYWxzZSkpIHtcbiAgICBzdWJtaXRCVE5WaXNpYmxlID0gZmFsc2U7XG4gICAgZGlyZWN0U3VibWl0dGluZyA9IHBoLmdldChcImRpcmVjdFwiKTtcbn1cbmlmIChwYXJhbUNoZWNrZXIocGguZ2V0KFwicG9ydGFibGVcIiksIGZhbHNlKSkge1xuICAgIGRpcmVjdFN1Ym1pdHRpbmcgPSB0cnVlO1xuICAgIHR5cGVzVmlzaWJsZSA9IGZhbHNlO1xuICAgIGlucHV0VmlzaWJsZSA9IGZhbHNlO1xuICAgIHN1Ym1pdEJUTlZpc2libGUgPSBmYWxzZTtcbn1cbmZ1bmN0aW9uIGhpZ2hsaWdodChlKSB7XG4gICAgaGlnaGxpZ2h0ZWQgPSB0cnVlO1xufVxuZnVuY3Rpb24gdW5oaWdobGlnaHQoZSkge1xuICAgIGhpZ2hsaWdodGVkID0gZmFsc2U7XG59XG4vL0B0cy1pZ25vcmVcbmxldCBfZ2xvYmFsRGF0YSA9IGdsb2JhbERhdGE7XG5sZXQgY29tcGlsZXJzID0gT2JqZWN0LmtleXMoX2dsb2JhbERhdGEuY29tcGlsZXJzKS5tYXAoKGtleSkgPT4gX2dsb2JhbERhdGEuY29tcGlsZXJzW2tleV0pO1xubGV0IGZpbGVzID0gW107XG5sZXQgZGF0YVRyYW5zZmVyID0geyBmaWxlczogW10gfTtcbmxldCBpbnB1dCA9IGRhdGFUcmFuc2ZlcjtcbmZ1bmN0aW9uIGhhbmRsZURyb3AoZSkge1xuICAgIGRhdGFUcmFuc2ZlciA9IGUuZGF0YVRyYW5zZmVyO1xuICAgIGlucHV0LmZpbGVzID0gZGF0YVRyYW5zZmVyLmZpbGVzO1xuICAgIGZpbGVzID0gaW5wdXQuZmlsZXM7XG4gICAgdW5oaWdobGlnaHQoZSk7XG4gICAgaWYgKGRpcmVjdFN1Ym1pdHRpbmcpIHtcbiAgICAgICAgY2xpY2tTdWJtaXQoKTtcbiAgICB9XG59XG5sZXQgc3VibWl0YWJsZSA9IGZhbHNlO1xuJDoge1xuICAgIHN1Ym1pdGFibGUgPSBmaWxlcy5sZW5ndGggPT0gMDtcbn1cbmZ1bmN0aW9uIGNsaWNrU3VibWl0KCkge1xuICAgIGdyZWNhcHRjaGEucmVhZHkoKCkgPT4ge1xuICAgICAgICBncmVjYXB0Y2hhXG4gICAgICAgICAgICAuZXhlY3V0ZSh7IFwiZW52XCI6IHsgXCJTSVRFS0VZXCI6IFwiNkxmX2xGSWFBQUFBQUJuWXpCRjJkVE9kV2thdjRuOWlndzVwNzJPRlwiLCBcIlNJVEVUT0tFTlwiOiBcIjZMZl9sRklhQUFBQUFPV1N5U1RETzh1cUZvTjY3Z1JwSm0yNFZrUFdcIiB9IH0uZW52LlNJVEVLRVksIHsgYWN0aW9uOiBcInN1Ym1pdFwiIH0pXG4gICAgICAgICAgICAudGhlbihzdWJtaXRpdCk7XG4gICAgfSk7XG59XG5mdW5jdGlvbiBzdWJtaXRpdCh0b2tlbikge1xuICAgIHJldHVybiBfX2F3YWl0ZXIodGhpcywgdm9pZCAwLCB2b2lkIDAsIGZ1bmN0aW9uKiAoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwic3VibWl0dGVkXCIsIGZpbGVzKTtcbiAgICAgICAgdmFyIGRhdGEgPSBuZXcgRm9ybURhdGEoKTtcbiAgICAgICAgLy8gdGhlIGZpbGVcbiAgICAgICAgZGF0YS5hcHBlbmQoXCJmaWxlXCIsIGlucHV0LmZpbGVzWzBdKTtcbiAgICAgICAgLy8gdGhlIGNvbXBpbGVyIHR5cGVcbiAgICAgICAgZGF0YS5hcHBlbmQoXCJ0eXBlXCIsIFwiXCIgKyBzZWxlY3RlZFR5cGUpO1xuICAgICAgICAvLyB0aGUgdXNlciBjYXB0Y2hhIHRva2VuXG4gICAgICAgIGRhdGEuYXBwZW5kKFwiZy1yZWNhcHRjaGFcIiwgdG9rZW4pO1xuICAgICAgICAvLyBjaGFuZ2luZyB0aGUgdmlldyBtb2RlIHRvIFwiaW4gcHJvZ3Jlc3MuLlwiXG4gICAgICAgIHZtb2QgPSAxO1xuICAgICAgICBjb25zdCByZXN1bHQgPSB5aWVsZCBmZXRjaChcIi4vdXBsb2FkXCIsIHtcbiAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgICBib2R5OiBkYXRhLFxuICAgICAgICB9KTtcbiAgICAgICAgc3dpdGNoIChyZXN1bHQuc3RhdHVzKSB7XG4gICAgICAgICAgICBjYXNlIDIwMDpcbiAgICAgICAgICAgICAgICBkb3dubG9hZFRoZUZpbGUocmVzdWx0LnVybCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGVycm9yTWVzc2FnZSgoeWllbGQgcmVzdWx0Lmpzb24oKSkubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cbjwvc2NyaXB0PlxyXG5cclxuPGRpdlxyXG4gICAgaWQ9XCJtYWluXCJcclxuICAgIGNsYXNzPXtoaWdobGlnaHRlZCA/IFwiaGlnaGxpZ2h0XCIgOiBcIlwifVxyXG4gICAgb246ZHJhZ2VudGVyfHByZXZlbnREZWZhdWx0PXtoaWdobGlnaHR9XHJcbiAgICBvbjpkcmFnb3ZlcnxwcmV2ZW50RGVmYXVsdD17aGlnaGxpZ2h0fVxyXG4gICAgb246ZHJhZ2xlYXZlfHByZXZlbnREZWZhdWx0PXt1bmhpZ2hsaWdodH1cclxuICAgIG9uOmRyb3B8cHJldmVudERlZmF1bHQ9e2hhbmRsZURyb3B9XHJcbj5cclxuICAgIDxkaXY+RHJhZyBhbmQgRHJvcDwvZGl2PlxyXG5cclxuICAgIHsjaWYgc3VibWl0QlROVmlzaWJsZX1cclxuICAgICAgICA8aW5wdXRcclxuICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgIG9uOmNsaWNrPXtjbGlja1N1Ym1pdH1cclxuICAgICAgICAgICAgdmFsdWU9XCJzdWJtaXRcIlxyXG4gICAgICAgICAgICBkaXNhYmxlZD17IWNvbXBpbGVycyB8fCBzdWJtaXRhYmxlfVxyXG4gICAgICAgIC8+PGJyIC8+XHJcbiAgICB7L2lmfVxyXG5cclxuICAgIHsjaWYgdHlwZXNWaXNpYmxlfVxyXG4gICAgICAgIDxkaXYgc3R5bGU9XCJwYWRkaW5nOjEwcHggMTBweDtcIj5cclxuICAgICAgICAgICAgPGgzPlxyXG4gICAgICAgICAgICAgICAgY29tcGlsZSB3aXRoXHJcbiAgICAgICAgICAgICAgICA8c2VsZWN0IG5hbWU9XCJ0eXBlXCIgZGVmYXVsdD17ZmFsc2V9IGJpbmQ6dmFsdWU9e3NlbGVjdGVkVHlwZX0+XHJcbiAgICAgICAgICAgICAgICAgICAgeyNlYWNoIGNvbXBpbGVycyBhcyBvcHRpb259XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9e29wdGlvbi5uYW1lfT57b3B0aW9uLm5hbWV9PC9vcHRpb24+XHJcbiAgICAgICAgICAgICAgICAgICAgey9lYWNofVxyXG4gICAgICAgICAgICAgICAgPC9zZWxlY3Q+XHJcbiAgICAgICAgICAgIDwvaDM+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICB7L2lmfVxyXG48L2Rpdj5cclxuXHJcbjxzdHlsZT5cclxuICAgICoge1xyXG4gICAgICAgIHRyYW5zaXRpb246IGFsbCAwLjRzO1xyXG4gICAgICAgIGZvbnQtc2l6ZTogNXZ3O1xyXG4gICAgfVxyXG5cclxuICAgICNtYWluIHtcclxuICAgICAgICBwYWRkaW5nOiA1dnc7XHJcbiAgICAgICAgcG9zaXRpb246IGZpeGVkO1xyXG4gICAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICAgIGhlaWdodDogMTAwJTtcclxuICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XHJcbiAgICAgICAgYm9yZGVyOiAxMHZoIGRhc2hlZCAjYzNkM2Q4O1xyXG4gICAgfVxyXG5cclxuICAgIC5oaWdobGlnaHQge1xyXG4gICAgICAgIGNvbG9yOiB3aGl0ZTtcclxuICAgICAgICBib3JkZXI6IDEwdmggc29saWQgcmdiKDI1MSwgMjQ0LCAyNDQpICFpbXBvcnRhbnQ7XHJcbiAgICAgICAgYmFja2dyb3VuZDogIzRkZDVmZjtcclxuICAgIH1cclxuXHJcbiAgICBAa2V5ZnJhbWVzIHR5cGUge1xyXG4gICAgICAgIGZyb20ge1xyXG4gICAgICAgICAgICBib3gtc2hhZG93OiBpbnNldCAtM3B4IDBweCAwcHggIzg4ODtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRvIHtcclxuICAgICAgICAgICAgYm94LXNoYWRvdzogaW5zZXQgLTNweCAwcHggMHB4IHRyYW5zcGFyZW50O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuPC9zdHlsZT5cclxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQW1JSSxlQUFFLENBQUMsQUFDQyxVQUFVLENBQUUsR0FBRyxDQUFDLElBQUksQ0FDcEIsU0FBUyxDQUFFLEdBQUcsQUFDbEIsQ0FBQyxBQUVELEtBQUssZUFBQyxDQUFDLEFBQ0gsT0FBTyxDQUFFLEdBQUcsQ0FDWixRQUFRLENBQUUsS0FBSyxDQUNmLEtBQUssQ0FBRSxJQUFJLENBQ1gsTUFBTSxDQUFFLElBQUksQ0FDWixVQUFVLENBQUUsTUFBTSxDQUNsQixNQUFNLENBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEFBQy9CLENBQUMsQUFFRCxVQUFVLGVBQUMsQ0FBQyxBQUNSLEtBQUssQ0FBRSxLQUFLLENBQ1osTUFBTSxDQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQ2hELFVBQVUsQ0FBRSxPQUFPLEFBQ3ZCLENBQUMsQUFFRCxXQUFXLG1CQUFLLENBQUMsQUFDYixJQUFJLEFBQUMsQ0FBQyxBQUNGLFVBQVUsQ0FBRSxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxBQUN2QyxDQUFDLEFBRUQsRUFBRSxBQUFDLENBQUMsQUFDQSxVQUFVLENBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFdBQVcsQUFDOUMsQ0FBQyxBQUNMLENBQUMifQ== */";
    	append_dev(document.head, style);
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i];
    	return child_ctx;
    }

    // (108:4) {#if submitBTNVisible}
    function create_if_block_1(ctx) {
    	let input_1;
    	let input_1_disabled_value;
    	let br;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input_1 = element("input");
    			br = element("br");
    			attr_dev(input_1, "type", "button");
    			input_1.value = "submit";
    			input_1.disabled = input_1_disabled_value = !/*compilers*/ ctx[7] || /*submitable*/ ctx[4];
    			attr_dev(input_1, "class", "svelte-1b9ng65");
    			add_location(input_1, file$3, 108, 8, 3697);
    			attr_dev(br, "class", "svelte-1b9ng65");
    			add_location(br, file$3, 113, 10, 3855);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input_1, anchor);
    			insert_dev(target, br, anchor);

    			if (!mounted) {
    				dispose = listen_dev(input_1, "click", /*clickSubmit*/ ctx[9], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*submitable*/ 16 && input_1_disabled_value !== (input_1_disabled_value = !/*compilers*/ ctx[7] || /*submitable*/ ctx[4])) {
    				prop_dev(input_1, "disabled", input_1_disabled_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input_1);
    			if (detaching) detach_dev(br);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(108:4) {#if submitBTNVisible}",
    		ctx
    	});

    	return block;
    }

    // (117:4) {#if typesVisible}
    function create_if_block(ctx) {
    	let div;
    	let h3;
    	let t;
    	let select;
    	let mounted;
    	let dispose;
    	let each_value = /*compilers*/ ctx[7];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			t = text("compile with\r\n                ");
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(select, "name", "type");
    			attr_dev(select, "default", false);
    			attr_dev(select, "class", "svelte-1b9ng65");
    			if (/*selectedType*/ ctx[3] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[14].call(select));
    			add_location(select, file$3, 120, 16, 4006);
    			attr_dev(h3, "class", "svelte-1b9ng65");
    			add_location(h3, file$3, 118, 12, 3954);
    			set_style(div, "padding", "10px 10px");
    			attr_dev(div, "class", "svelte-1b9ng65");
    			add_location(div, file$3, 117, 8, 3908);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(h3, t);
    			append_dev(h3, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*selectedType*/ ctx[3]);

    			if (!mounted) {
    				dispose = listen_dev(select, "change", /*select_change_handler*/ ctx[14]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*compilers*/ 128) {
    				each_value = /*compilers*/ ctx[7];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*selectedType, compilers*/ 136) {
    				select_option(select, /*selectedType*/ ctx[3]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(117:4) {#if typesVisible}",
    		ctx
    	});

    	return block;
    }

    // (122:20) {#each compilers as option}
    function create_each_block(ctx) {
    	let option;
    	let t_value = /*option*/ ctx[25].name + "";
    	let t;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = ctx[25].name;
    			option.value = option.__value;
    			attr_dev(option, "class", "svelte-1b9ng65");
    			add_location(option, file$3, 122, 24, 4143);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(122:20) {#each compilers as option}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div1;
    	let div0;
    	let t1;
    	let t2;
    	let div1_class_value;
    	let mounted;
    	let dispose;
    	let if_block0 = /*submitBTNVisible*/ ctx[2] && create_if_block_1(ctx);
    	let if_block1 = /*typesVisible*/ ctx[1] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			div0.textContent = "Drag and Drop";
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if (if_block1) if_block1.c();
    			attr_dev(div0, "class", "svelte-1b9ng65");
    			add_location(div0, file$3, 105, 4, 3633);
    			attr_dev(div1, "id", "main");
    			attr_dev(div1, "class", div1_class_value = "" + (null_to_empty(/*highlighted*/ ctx[0] ? "highlight" : "") + " svelte-1b9ng65"));
    			add_location(div1, file$3, 97, 0, 3384);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div1, t1);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(div1, t2);
    			if (if_block1) if_block1.m(div1, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "dragenter", prevent_default(/*highlight*/ ctx[5]), false, true, false),
    					listen_dev(div1, "dragover", prevent_default(/*highlight*/ ctx[5]), false, true, false),
    					listen_dev(div1, "dragleave", prevent_default(/*unhighlight*/ ctx[6]), false, true, false),
    					listen_dev(div1, "drop", prevent_default(/*handleDrop*/ ctx[8]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*submitBTNVisible*/ ctx[2]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					if_block0.m(div1, t2);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*typesVisible*/ ctx[1]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					if_block1.m(div1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*highlighted*/ 1 && div1_class_value !== (div1_class_value = "" + (null_to_empty(/*highlighted*/ ctx[0] ? "highlight" : "") + " svelte-1b9ng65"))) {
    				attr_dev(div1, "class", div1_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Submiting_page", slots, []);

    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	let { downloadTheFile } = $$props;
    	let { errorMessage } = $$props;
    	let { vmod } = $$props;

    	let directSubmitting = false,
    		highlighted = false,
    		typesVisible = true,
    		submitBTNVisible = true,
    		inputVisible = false;

    	const ph = new pdh.QParamer(window);

    	const paramChecker = (prm, oud, reverse = false) => {
    		return prm === undefined
    		? oud
    		: prm === null || prm ? !reverse : reverse;
    	};

    	let maintype = paramChecker(ph.get("type"), 0);
    	console.log(typesVisible, ph.get("hidetypes"));
    	typesVisible = paramChecker(ph.get("hidetypes"), typesVisible, true);
    	inputVisible = !paramChecker(ph.get("hideinput"), inputVisible, true);
    	let selectedType = maintype;

    	if (paramChecker(ph.get("hideinput"), false)) {
    		submitBTNVisible = false;
    		directSubmitting = ph.get("direct");
    	}

    	if (paramChecker(ph.get("portable"), false)) {
    		directSubmitting = true;
    		typesVisible = false;
    		inputVisible = false;
    		submitBTNVisible = false;
    	}

    	function highlight(e) {
    		$$invalidate(0, highlighted = true);
    	}

    	function unhighlight(e) {
    		$$invalidate(0, highlighted = false);
    	}

    	//@ts-ignore
    	let _globalData = globalData;

    	let compilers = Object.keys(_globalData.compilers).map(key => _globalData.compilers[key]);
    	let files = [];
    	let dataTransfer = { files: [] };
    	let input = dataTransfer;

    	function handleDrop(e) {
    		dataTransfer = e.dataTransfer;
    		input.files = dataTransfer.files;
    		$$invalidate(13, files = input.files);
    		unhighlight();

    		if (directSubmitting) {
    			clickSubmit();
    		}
    	}

    	let submitable = false;

    	function clickSubmit() {
    		grecaptcha.ready(() => {
    			grecaptcha.execute(
    				({
    					"env": {
    						"SITEKEY": "6Lf_lFIaAAAAABnYzBF2dTOdWkav4n9igw5p72OF",
    						"SITETOKEN": "6Lf_lFIaAAAAAOWSySTDO8uqFoN67gRpJm24VkPW"
    					}
    				}).env.SITEKEY,
    				{ action: "submit" }
    			).then(submitit);
    		});
    	}

    	function submitit(token) {
    		return __awaiter(this, void 0, void 0, function* () {
    			console.log("submitted", files);
    			var data = new FormData();

    			// the file
    			data.append("file", input.files[0]);

    			// the compiler type
    			data.append("type", "" + selectedType);

    			// the user captcha token
    			data.append("g-recaptcha", token);

    			// changing the view mode to "in progress.."
    			$$invalidate(10, vmod = 1);

    			const result = yield fetch("./upload", { method: "POST", body: data });

    			switch (result.status) {
    				case 200:
    					downloadTheFile(result.url);
    					break;
    				default:
    					errorMessage((yield result.json()).message);
    					break;
    			}
    		});
    	}

    	const writable_props = ["downloadTheFile", "errorMessage", "vmod"];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Submiting_page> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		selectedType = select_value(this);
    		$$invalidate(3, selectedType);
    		$$invalidate(7, compilers);
    	}

    	$$self.$$set = $$props => {
    		if ("downloadTheFile" in $$props) $$invalidate(11, downloadTheFile = $$props.downloadTheFile);
    		if ("errorMessage" in $$props) $$invalidate(12, errorMessage = $$props.errorMessage);
    		if ("vmod" in $$props) $$invalidate(10, vmod = $$props.vmod);
    	};

    	$$self.$capture_state = () => ({
    		__awaiter,
    		pdh,
    		downloadTheFile,
    		errorMessage,
    		vmod,
    		directSubmitting,
    		highlighted,
    		typesVisible,
    		submitBTNVisible,
    		inputVisible,
    		ph,
    		paramChecker,
    		maintype,
    		selectedType,
    		highlight,
    		unhighlight,
    		_globalData,
    		compilers,
    		files,
    		dataTransfer,
    		input,
    		handleDrop,
    		submitable,
    		clickSubmit,
    		submitit
    	});

    	$$self.$inject_state = $$props => {
    		if ("__awaiter" in $$props) __awaiter = $$props.__awaiter;
    		if ("downloadTheFile" in $$props) $$invalidate(11, downloadTheFile = $$props.downloadTheFile);
    		if ("errorMessage" in $$props) $$invalidate(12, errorMessage = $$props.errorMessage);
    		if ("vmod" in $$props) $$invalidate(10, vmod = $$props.vmod);
    		if ("directSubmitting" in $$props) directSubmitting = $$props.directSubmitting;
    		if ("highlighted" in $$props) $$invalidate(0, highlighted = $$props.highlighted);
    		if ("typesVisible" in $$props) $$invalidate(1, typesVisible = $$props.typesVisible);
    		if ("submitBTNVisible" in $$props) $$invalidate(2, submitBTNVisible = $$props.submitBTNVisible);
    		if ("inputVisible" in $$props) inputVisible = $$props.inputVisible;
    		if ("maintype" in $$props) maintype = $$props.maintype;
    		if ("selectedType" in $$props) $$invalidate(3, selectedType = $$props.selectedType);
    		if ("_globalData" in $$props) _globalData = $$props._globalData;
    		if ("compilers" in $$props) $$invalidate(7, compilers = $$props.compilers);
    		if ("files" in $$props) $$invalidate(13, files = $$props.files);
    		if ("dataTransfer" in $$props) dataTransfer = $$props.dataTransfer;
    		if ("input" in $$props) input = $$props.input;
    		if ("submitable" in $$props) $$invalidate(4, submitable = $$props.submitable);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*files*/ 8192) {
    			 {
    				$$invalidate(4, submitable = files.length == 0);
    			}
    		}
    	};

    	return [
    		highlighted,
    		typesVisible,
    		submitBTNVisible,
    		selectedType,
    		submitable,
    		highlight,
    		unhighlight,
    		compilers,
    		handleDrop,
    		clickSubmit,
    		vmod,
    		downloadTheFile,
    		errorMessage,
    		files,
    		select_change_handler
    	];
    }

    class Submiting_page extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-1b9ng65-style")) add_css$3();

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			downloadTheFile: 11,
    			errorMessage: 12,
    			vmod: 10
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Submiting_page",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*downloadTheFile*/ ctx[11] === undefined && !("downloadTheFile" in props)) {
    			console_1.warn("<Submiting_page> was created without expected prop 'downloadTheFile'");
    		}

    		if (/*errorMessage*/ ctx[12] === undefined && !("errorMessage" in props)) {
    			console_1.warn("<Submiting_page> was created without expected prop 'errorMessage'");
    		}

    		if (/*vmod*/ ctx[10] === undefined && !("vmod" in props)) {
    			console_1.warn("<Submiting_page> was created without expected prop 'vmod'");
    		}
    	}

    	get downloadTheFile() {
    		throw new Error("<Submiting_page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set downloadTheFile(value) {
    		throw new Error("<Submiting_page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get errorMessage() {
    		throw new Error("<Submiting_page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set errorMessage(value) {
    		throw new Error("<Submiting_page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get vmod() {
    		throw new Error("<Submiting_page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set vmod(value) {
    		throw new Error("<Submiting_page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* front-end/src/compiler/main/App.svelte generated by Svelte v3.31.2 */

    const { console: console_1$1, document: document_1 } = globals;
    const file$4 = "front-end/src/compiler/main/App.svelte";

    function add_css$4() {
    	var style = element("style");
    	style.id = "svelte-1etdwhu-style";
    	style.textContent = "footer.svelte-1etdwhu{bottom:0;position:fixed;z-index:150;height:35px;opacity:0.5}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXBwLnN2ZWx0ZSIsInNvdXJjZXMiOlsiQXBwLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0IGxhbmc9XCJ0c1wiPmltcG9ydCBNZXNzYWdlIGZyb20gXCIuLi9tZXNzYWdlL21lc3NhZ2Uuc3ZlbHRlXCI7XG5pbXBvcnQgRmluaXNoZWRQYWdlIGZyb20gXCIuL2NvbXBvbmVudHMvZmluaXNoZWRfcGFnZS5zdmVsdGVcIjtcbmltcG9ydCBMb2FkaW5nUGFnZSBmcm9tIFwiLi9jb21wb25lbnRzL2xvYWRpbmdfcGFnZS5zdmVsdGVcIjtcbmltcG9ydCBTdWJtaXRpbmdQYWdlIGZyb20gXCIuL2NvbXBvbmVudHMvc3VibWl0aW5nX3BhZ2Uuc3ZlbHRlXCI7XG5sZXQgdm1vZCA9IDA7XG5sZXQgbWVzc2FnZSA9IFwiXCI7XG5jb25zdCBlcnJvck1lc3NhZ2UgPSAoX21lc2FnZSkgPT4ge1xuICAgIG1lc3NhZ2UgPSBfbWVzYWdlO1xuICAgIHZtb2QgPSAzO1xuICAgIGNvbnNvbGUubG9nKG1lc3NhZ2UpO1xufTtcbmxldCB1cmwgPSBcIlwiO1xuY29uc3QgZG93bmxvYWRUaGVGaWxlID0gKF91cmwpID0+IHtcbiAgICB1cmwgPSBfdXJsO1xuICAgIHZtb2QgPSAyO1xufTtcbjwvc2NyaXB0PlxyXG5cclxuPGxpbmsgc3JjPVwiaHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9yZWNhcHRjaGEvYXBpLmpzXCIgLz5cclxuXHJcbnsjaWYgdm1vZCA9PSAxfVxyXG4gICAgPExvYWRpbmdQYWdlIC8+XHJcbns6ZWxzZSBpZiB2bW9kID09IDJ9XHJcbiAgICA8RmluaXNoZWRQYWdlIHt1cmx9IC8+XHJcbns6ZWxzZSBpZiB2bW9kID09IDN9XHJcbiAgICA8TWVzc2FnZSB7bWVzc2FnZX0gLz5cclxuezplbHNlfVxyXG4gICAgPFN1Ym1pdGluZ1BhZ2UgYmluZDp2bW9kIHtlcnJvck1lc3NhZ2V9IHtkb3dubG9hZFRoZUZpbGV9IC8+XHJcbnsvaWZ9XHJcblxyXG48Zm9vdGVyXHJcbiAgICBjbGFzcz1cInBvd2VyZGJ5XCJcclxuICAgIHN0eWxlPVwidG9wOntkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wICtcclxuICAgICAgICAoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodCAtIHRoaXMub2Zmc2V0SGVpZ2h0KX1cIlxyXG4+XHJcbiAgICBQb3dlcmQgQnkgPGEgaHJlZj1cImh0dHA6Ly93d3cuV29yZDJMYXRleC5uZXRcIj5Xb3JkMkxhdGV4Lm5ldDwvYT4gVGVhbVxyXG48L2Zvb3Rlcj5cclxuXHJcbjxzdHlsZT5cclxuICAgIGh0bWwge1xyXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcclxuICAgICAgICBoZWlnaHQ6IDEwMCU7XHJcbiAgICB9XHJcblxyXG4gICAgYm9keSB7XHJcbiAgICAgICAgcG9zaXRpb246IGZpeGVkO1xyXG4gICAgICAgIGZvbnQtZmFtaWx5OiBcIkxhdG9cIiwgc2Fucy1zZXJpZjtcclxuICAgICAgICBjb2xvcjogIzg4ODtcclxuICAgICAgICBtYXJnaW46IDA7XHJcbiAgICAgICAgaGVpZ2h0OiAxMDAlO1xyXG4gICAgfVxyXG5cclxuICAgIGZvb3RlciB7XHJcbiAgICAgICAgYm90dG9tOiAwO1xyXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcclxuICAgICAgICB6LWluZGV4OiAxNTA7XHJcbiAgICAgICAgaGVpZ2h0OiAzNXB4O1xyXG4gICAgICAgIG9wYWNpdHk6IDAuNTtcclxuICAgIH1cclxuPC9zdHlsZT5cclxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQW9ESSxNQUFNLGVBQUMsQ0FBQyxBQUNKLE1BQU0sQ0FBRSxDQUFDLENBQ1QsUUFBUSxDQUFFLEtBQUssQ0FDZixPQUFPLENBQUUsR0FBRyxDQUNaLE1BQU0sQ0FBRSxJQUFJLENBQ1osT0FBTyxDQUFFLEdBQUcsQUFDaEIsQ0FBQyJ9 */";
    	append_dev(document_1.head, style);
    }

    // (27:0) {:else}
    function create_else_block(ctx) {
    	let submitingpage;
    	let updating_vmod;
    	let current;

    	function submitingpage_vmod_binding(value) {
    		/*submitingpage_vmod_binding*/ ctx[5].call(null, value);
    	}

    	let submitingpage_props = {
    		errorMessage: /*errorMessage*/ ctx[3],
    		downloadTheFile: /*downloadTheFile*/ ctx[4]
    	};

    	if (/*vmod*/ ctx[0] !== void 0) {
    		submitingpage_props.vmod = /*vmod*/ ctx[0];
    	}

    	submitingpage = new Submiting_page({
    			props: submitingpage_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(submitingpage, "vmod", submitingpage_vmod_binding));

    	const block = {
    		c: function create() {
    			create_component(submitingpage.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(submitingpage, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const submitingpage_changes = {};

    			if (!updating_vmod && dirty & /*vmod*/ 1) {
    				updating_vmod = true;
    				submitingpage_changes.vmod = /*vmod*/ ctx[0];
    				add_flush_callback(() => updating_vmod = false);
    			}

    			submitingpage.$set(submitingpage_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(submitingpage.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(submitingpage.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(submitingpage, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(27:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (25:20) 
    function create_if_block_2(ctx) {
    	let message_1;
    	let current;

    	message_1 = new Message({
    			props: { message: /*message*/ ctx[1] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(message_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(message_1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const message_1_changes = {};
    			if (dirty & /*message*/ 2) message_1_changes.message = /*message*/ ctx[1];
    			message_1.$set(message_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(message_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(message_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(message_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(25:20) ",
    		ctx
    	});

    	return block;
    }

    // (23:20) 
    function create_if_block_1$1(ctx) {
    	let finishedpage;
    	let current;

    	finishedpage = new Finished_page({
    			props: { url: /*url*/ ctx[2] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(finishedpage.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(finishedpage, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const finishedpage_changes = {};
    			if (dirty & /*url*/ 4) finishedpage_changes.url = /*url*/ ctx[2];
    			finishedpage.$set(finishedpage_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(finishedpage.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(finishedpage.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(finishedpage, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(23:20) ",
    		ctx
    	});

    	return block;
    }

    // (21:0) {#if vmod == 1}
    function create_if_block$1(ctx) {
    	let loadingpage;
    	let current;
    	loadingpage = new Loading_page({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(loadingpage.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(loadingpage, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(loadingpage.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(loadingpage.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(loadingpage, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(21:0) {#if vmod == 1}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let link;
    	let link_src_value;
    	let t0;
    	let current_block_type_index;
    	let if_block;
    	let t1;
    	let footer;
    	let t2;
    	let a;
    	let t4;
    	let current;
    	const if_block_creators = [create_if_block$1, create_if_block_1$1, create_if_block_2, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*vmod*/ ctx[0] == 1) return 0;
    		if (/*vmod*/ ctx[0] == 2) return 1;
    		if (/*vmod*/ ctx[0] == 3) return 2;
    		return 3;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			link = element("link");
    			t0 = space();
    			if_block.c();
    			t1 = space();
    			footer = element("footer");
    			t2 = text("Powerd By ");
    			a = element("a");
    			a.textContent = "Word2Latex.net";
    			t4 = text(" Team");
    			if (link.src !== (link_src_value = "https://www.google.com/recaptcha/api.js")) attr_dev(link, "src", link_src_value);
    			add_location(link, file$4, 18, 0, 483);
    			attr_dev(a, "href", "http://www.Word2Latex.net");
    			add_location(a, file$4, 35, 14, 935);
    			attr_dev(footer, "class", "powerdby svelte-1etdwhu");
    			set_style(footer, "top", document.documentElement.scrollTop + (document.documentElement.clientHeight - this.offsetHeight));
    			add_location(footer, file$4, 30, 0, 762);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, link, anchor);
    			insert_dev(target, t0, anchor);
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, footer, anchor);
    			append_dev(footer, t2);
    			append_dev(footer, a);
    			append_dev(footer, t4);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(t1.parentNode, t1);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(link);
    			if (detaching) detach_dev(t0);
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let vmod = 0;
    	let message = "";

    	const errorMessage = _mesage => {
    		$$invalidate(1, message = _mesage);
    		$$invalidate(0, vmod = 3);
    		console.log(message);
    	};

    	let url = "";

    	const downloadTheFile = _url => {
    		$$invalidate(2, url = _url);
    		$$invalidate(0, vmod = 2);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function submitingpage_vmod_binding(value) {
    		vmod = value;
    		$$invalidate(0, vmod);
    	}

    	$$self.$capture_state = () => ({
    		Message,
    		FinishedPage: Finished_page,
    		LoadingPage: Loading_page,
    		SubmitingPage: Submiting_page,
    		vmod,
    		message,
    		errorMessage,
    		url,
    		downloadTheFile
    	});

    	$$self.$inject_state = $$props => {
    		if ("vmod" in $$props) $$invalidate(0, vmod = $$props.vmod);
    		if ("message" in $$props) $$invalidate(1, message = $$props.message);
    		if ("url" in $$props) $$invalidate(2, url = $$props.url);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [vmod, message, url, errorMessage, downloadTheFile, submitingpage_vmod_binding];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document_1.getElementById("svelte-1etdwhu-style")) add_css$4();
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
    });

    return app;

}());
