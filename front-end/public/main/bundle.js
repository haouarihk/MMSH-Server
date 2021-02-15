(function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
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
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
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

    /* front-end/src/main/components/pluginItem.svelte generated by Svelte v3.31.2 */

    const file = "front-end/src/main/components/pluginItem.svelte";

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-qeayuj-style";
    	style.textContent = ".card-link.svelte-qeayuj{color:brown;border:burlywood;transition:color 0.5s}.card-link.svelte-qeayuj:hover{color:rgb(235, 148, 148);transition:color 0.5s}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGx1Z2luSXRlbS5zdmVsdGUiLCJzb3VyY2VzIjpbInBsdWdpbkl0ZW0uc3ZlbHRlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQgbGFuZz1cInRzXCI+ZXhwb3J0IGxldCBuYW1lID0gXCJkZWZhdWx0XCI7XG5leHBvcnQgbGV0IGRpc2NyaXB0aW9uID0gXCJubyBkaXNjcmlwdGlvbiBhdmFsaWFibGVcIjtcbmV4cG9ydCBsZXQgbWFpbmRpciA9IFwiL2RlZnVhbHRcIjtcbjwvc2NyaXB0PlxyXG5cclxuPGRpdiBjbGFzcz1cImdhbGxlcnlfcHJvZHVjdCBjb2wtbGctNCBjb2wtbWQtNCBjb2wtc20tNCBjb2wteHMtNiBmaWx0ZXIgaGRwZVwiPlxyXG4gICAgPGRpdiBjbGFzcz1cImNhcmRcIiBzdHlsZT1cIndpZHRoOiAxOHJlbTtcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZC1ib2R5XCI+XHJcbiAgICAgICAgICAgIDxoNSBjbGFzcz1cImNhcmQtdGl0bGVcIj57bmFtZX08L2g1PlxyXG4gICAgICAgICAgICA8aDYgY2xhc3M9XCJjYXJkLXN1YnRpdGxlIG1iLTIgdGV4dC1tdXRlZFwiPnttYWluZGlyfTwvaDY+XHJcbiAgICAgICAgICAgIDxwIGNsYXNzPVwiY2FyZC10ZXh0XCI+XHJcbiAgICAgICAgICAgICAgICB7ZGlzY3JpcHRpb259XHJcbiAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgPGEgaHJlZj17bWFpbmRpcn0gY2xhc3M9XCJjYXJkLWxpbmtcIj5PcGVuPC9hPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgPC9kaXY+XHJcbjwvZGl2PlxyXG5cclxuPHN0eWxlPlxyXG4gICAgLmNhcmQtbGluayB7XHJcbiAgICAgICAgY29sb3I6IGJyb3duO1xyXG4gICAgICAgIGJvcmRlcjogYnVybHl3b29kO1xyXG4gICAgICAgIHRyYW5zaXRpb246IGNvbG9yIDAuNXM7XHJcbiAgICB9XHJcbiAgICAuY2FyZC1saW5rOmhvdmVyIHtcclxuICAgICAgICBjb2xvcjogcmdiKDIzNSwgMTQ4LCAxNDgpO1xyXG4gICAgICAgIHRyYW5zaXRpb246IGNvbG9yIDAuNXM7XHJcbiAgICB9XHJcbjwvc3R5bGU+XHJcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFtQkksVUFBVSxjQUFDLENBQUMsQUFDUixLQUFLLENBQUUsS0FBSyxDQUNaLE1BQU0sQ0FBRSxTQUFTLENBQ2pCLFVBQVUsQ0FBRSxLQUFLLENBQUMsSUFBSSxBQUMxQixDQUFDLEFBQ0Qsd0JBQVUsTUFBTSxBQUFDLENBQUMsQUFDZCxLQUFLLENBQUUsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FDekIsVUFBVSxDQUFFLEtBQUssQ0FBQyxJQUFJLEFBQzFCLENBQUMifQ== */";
    	append_dev(document.head, style);
    }

    function create_fragment(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let h5;
    	let t0;
    	let t1;
    	let h6;
    	let t2;
    	let t3;
    	let p;
    	let t4;
    	let t5;
    	let a;
    	let t6;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			h5 = element("h5");
    			t0 = text(/*name*/ ctx[0]);
    			t1 = space();
    			h6 = element("h6");
    			t2 = text(/*maindir*/ ctx[2]);
    			t3 = space();
    			p = element("p");
    			t4 = text(/*discription*/ ctx[1]);
    			t5 = space();
    			a = element("a");
    			t6 = text("Open");
    			attr_dev(h5, "class", "card-title");
    			add_location(h5, file, 8, 12, 316);
    			attr_dev(h6, "class", "card-subtitle mb-2 text-muted");
    			add_location(h6, file, 9, 12, 364);
    			attr_dev(p, "class", "card-text");
    			add_location(p, file, 10, 12, 434);
    			attr_dev(a, "href", /*maindir*/ ctx[2]);
    			attr_dev(a, "class", "card-link svelte-qeayuj");
    			add_location(a, file, 13, 12, 518);
    			attr_dev(div0, "class", "card-body");
    			add_location(div0, file, 7, 8, 279);
    			attr_dev(div1, "class", "card");
    			set_style(div1, "width", "18rem");
    			add_location(div1, file, 6, 4, 229);
    			attr_dev(div2, "class", "gallery_product col-lg-4 col-md-4 col-sm-4 col-xs-6 filter hdpe");
    			add_location(div2, file, 5, 0, 146);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, h5);
    			append_dev(h5, t0);
    			append_dev(div0, t1);
    			append_dev(div0, h6);
    			append_dev(h6, t2);
    			append_dev(div0, t3);
    			append_dev(div0, p);
    			append_dev(p, t4);
    			append_dev(div0, t5);
    			append_dev(div0, a);
    			append_dev(a, t6);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data_dev(t0, /*name*/ ctx[0]);
    			if (dirty & /*maindir*/ 4) set_data_dev(t2, /*maindir*/ ctx[2]);
    			if (dirty & /*discription*/ 2) set_data_dev(t4, /*discription*/ ctx[1]);

    			if (dirty & /*maindir*/ 4) {
    				attr_dev(a, "href", /*maindir*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
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
    	validate_slots("PluginItem", slots, []);
    	let { name = "default" } = $$props;
    	let { discription = "no discription avaliable" } = $$props;
    	let { maindir = "/defualt" } = $$props;
    	const writable_props = ["name", "discription", "maindir"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<PluginItem> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("discription" in $$props) $$invalidate(1, discription = $$props.discription);
    		if ("maindir" in $$props) $$invalidate(2, maindir = $$props.maindir);
    	};

    	$$self.$capture_state = () => ({ name, discription, maindir });

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("discription" in $$props) $$invalidate(1, discription = $$props.discription);
    		if ("maindir" in $$props) $$invalidate(2, maindir = $$props.maindir);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name, discription, maindir];
    }

    class PluginItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-qeayuj-style")) add_css();
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 0, discription: 1, maindir: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PluginItem",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get name() {
    		throw new Error("<PluginItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<PluginItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get discription() {
    		throw new Error("<PluginItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set discription(value) {
    		throw new Error("<PluginItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get maindir() {
    		throw new Error("<PluginItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set maindir(value) {
    		throw new Error("<PluginItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* front-end/src/main/App.svelte generated by Svelte v3.31.2 */
    const file$1 = "front-end/src/main/App.svelte";

    function add_css$1() {
    	var style = element("style");
    	style.id = "svelte-2yv3t0-style";
    	style.textContent = ".gallery-title.svelte-2yv3t0{font-size:36px;color:#42b32f;text-align:center;font-weight:500;margin-bottom:70px}.gallery-title.svelte-2yv3t0:after{content:\"\";position:absolute;width:7.5%;left:46.5%;height:45px;border-bottom:1px solid #5e5e5e}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXBwLnN2ZWx0ZSIsInNvdXJjZXMiOlsiQXBwLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0IGxhbmc9XCJ0c1wiPmltcG9ydCBQbHVnaW5JdGVtIGZyb20gXCIuL2NvbXBvbmVudHMvcGx1Z2luSXRlbS5zdmVsdGVcIjtcbi8vIEB0cy1pZ25vcmVcbmxldCBwbHVnaW5JdGVtcyA9IGdsb2JhbERhdGEucGx1Z2lucztcbjwvc2NyaXB0PlxyXG5cclxuPGRpdiBjbGFzcz1cImNvbnRhaW5lclwiPlxyXG4gICAgPGRpdiBjbGFzcz1cInJvd1wiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJnYWxsZXJ5IGNvbC1sZy0xMiBjb2wtbWQtMTIgY29sLXNtLTEyIGNvbC14cy0xMlwiPlxyXG4gICAgICAgICAgICA8aDEgY2xhc3M9XCJnYWxsZXJ5LXRpdGxlXCI+RmVhdHVyZXM8L2gxPlxyXG5cclxuICAgICAgICAgICAgeyNpZiBwbHVnaW5JdGVtcy5sZW5ndGggPD0gMH1cclxuICAgICAgICAgICAgICAgIFNvcnJ5IHRoZXJlIGFyZSBubyBGZWF0dXJlcyBpbnN0YWxsZWQgdG8gdGhpcyB3ZWJzaXRlXHJcbiAgICAgICAgICAgIHsvaWZ9XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIHsjZWFjaCBwbHVnaW5JdGVtcyBhcyBfcH1cclxuICAgICAgICAgICAgPFBsdWdpbkl0ZW0gey4uLl9wfSAvPlxyXG4gICAgICAgIHsvZWFjaH1cclxuICAgIDwvZGl2PlxyXG48L2Rpdj5cclxuXHJcbjxzdHlsZT5cclxuICAgIC5nYWxsZXJ5LXRpdGxlIHtcclxuICAgICAgICBmb250LXNpemU6IDM2cHg7XHJcbiAgICAgICAgY29sb3I6ICM0MmIzMmY7XHJcbiAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XHJcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogNzBweDtcclxuICAgIH1cclxuICAgIC5nYWxsZXJ5LXRpdGxlOmFmdGVyIHtcclxuICAgICAgICBjb250ZW50OiBcIlwiO1xyXG4gICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgICB3aWR0aDogNy41JTtcclxuICAgICAgICBsZWZ0OiA0Ni41JTtcclxuICAgICAgICBoZWlnaHQ6IDQ1cHg7XHJcbiAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICM1ZTVlNWU7XHJcbiAgICB9XHJcbiAgICAuZmlsdGVyLWJ1dHRvbiB7XHJcbiAgICAgICAgZm9udC1zaXplOiAxOHB4O1xyXG4gICAgICAgIGJvcmRlcjogMXB4IHNvbGlkICM0MmIzMmY7XHJcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNXB4O1xyXG4gICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcclxuICAgICAgICBjb2xvcjogIzQyYjMyZjtcclxuICAgICAgICBtYXJnaW4tYm90dG9tOiAzMHB4O1xyXG4gICAgfVxyXG4gICAgLmZpbHRlci1idXR0b246aG92ZXIge1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMThweDtcclxuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCAjNDJiMzJmO1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDVweDtcclxuICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XHJcbiAgICAgICAgY29sb3I6ICNmZmZmZmY7XHJcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogIzQyYjMyZjtcclxuICAgIH1cclxuICAgIC5idG4tZGVmYXVsdDphY3RpdmUgLmZpbHRlci1idXR0b246YWN0aXZlIHtcclxuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjNDJiMzJmO1xyXG4gICAgICAgIGNvbG9yOiB3aGl0ZTtcclxuICAgIH1cclxuXHJcbiAgICAucG9ydC1pbWFnZSB7XHJcbiAgICAgICAgd2lkdGg6IDEwMCU7XHJcbiAgICB9XHJcblxyXG4gICAgLmdhbGxlcnlfcHJvZHVjdCB7XHJcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMzBweDtcclxuICAgIH1cclxuPC9zdHlsZT5cclxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXNCSSxjQUFjLGNBQUMsQ0FBQyxBQUNaLFNBQVMsQ0FBRSxJQUFJLENBQ2YsS0FBSyxDQUFFLE9BQU8sQ0FDZCxVQUFVLENBQUUsTUFBTSxDQUNsQixXQUFXLENBQUUsR0FBRyxDQUNoQixhQUFhLENBQUUsSUFBSSxBQUN2QixDQUFDLEFBQ0QsNEJBQWMsTUFBTSxBQUFDLENBQUMsQUFDbEIsT0FBTyxDQUFFLEVBQUUsQ0FDWCxRQUFRLENBQUUsUUFBUSxDQUNsQixLQUFLLENBQUUsSUFBSSxDQUNYLElBQUksQ0FBRSxLQUFLLENBQ1gsTUFBTSxDQUFFLElBQUksQ0FDWixhQUFhLENBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLEFBQ3BDLENBQUMifQ== */";
    	append_dev(document.head, style);
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (11:12) {#if pluginItems.length <= 0}
    function create_if_block(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Sorry there are no Features installed to this website");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(11:12) {#if pluginItems.length <= 0}",
    		ctx
    	});

    	return block;
    }

    // (16:8) {#each pluginItems as _p}
    function create_each_block(ctx) {
    	let pluginitem;
    	let current;
    	const pluginitem_spread_levels = [/*_p*/ ctx[1]];
    	let pluginitem_props = {};

    	for (let i = 0; i < pluginitem_spread_levels.length; i += 1) {
    		pluginitem_props = assign(pluginitem_props, pluginitem_spread_levels[i]);
    	}

    	pluginitem = new PluginItem({ props: pluginitem_props, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(pluginitem.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(pluginitem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const pluginitem_changes = (dirty & /*pluginItems*/ 1)
    			? get_spread_update(pluginitem_spread_levels, [get_spread_object(/*_p*/ ctx[1])])
    			: {};

    			pluginitem.$set(pluginitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(pluginitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(pluginitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(pluginitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(16:8) {#each pluginItems as _p}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let h1;
    	let t1;
    	let t2;
    	let current;
    	let if_block = /*pluginItems*/ ctx[0].length <= 0 && create_if_block(ctx);
    	let each_value = /*pluginItems*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Features";
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(h1, "class", "gallery-title svelte-2yv3t0");
    			add_location(h1, file$1, 8, 12, 271);
    			attr_dev(div0, "class", "gallery col-lg-12 col-md-12 col-sm-12 col-xs-12");
    			add_location(div0, file$1, 7, 8, 196);
    			attr_dev(div1, "class", "row");
    			add_location(div1, file$1, 6, 4, 169);
    			attr_dev(div2, "class", "container");
    			add_location(div2, file$1, 5, 0, 140);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    			append_dev(div0, t1);
    			if (if_block) if_block.m(div0, null);
    			append_dev(div1, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*pluginItems*/ 1) {
    				each_value = /*pluginItems*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div1, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (if_block) if_block.d();
    			destroy_each(each_blocks, detaching);
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
    	validate_slots("App", slots, []);
    	let pluginItems = globalData.plugins;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ PluginItem, pluginItems });

    	$$self.$inject_state = $$props => {
    		if ("pluginItems" in $$props) $$invalidate(0, pluginItems = $$props.pluginItems);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [pluginItems];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		if (!document.getElementById("svelte-2yv3t0-style")) add_css$1();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
    });

    return app;

}());
