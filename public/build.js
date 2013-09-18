(function(undefined) {
  // The Opal object that is exposed globally
  var Opal = this.Opal = {};

  // Very root class
  function BasicObject(){}

  // Core Object class
  function Object(){}

  // Class' class
  function Class(){}

  // Module's class
  function Module(){}

  // the class of nil
  function NilClass(){}

  // TopScope is used for inheriting constants from the top scope
  var TopScope = function(){};

  // Opal just acts as the top scope
  TopScope.prototype = Opal;

  // To inherit scopes
  Opal.constructor  = TopScope;

  // This is a useful reference to global object inside ruby files
  Opal.global = this;

  // Minify common function calls
  var $hasOwn = Opal.hasOwnProperty;
  var $slice  = Opal.slice = Array.prototype.slice;

  // Generates unique id for every ruby object
  var unique_id = 0;

  // Return next unique id
  Opal.uid = function() {
    return unique_id++;
  };

  // Table holds all class variables
  Opal.cvars = {};

  // Globals table
  Opal.gvars = {};

  /*
   * Create a new constants scope for the given class with the given
   * base. Constants are looked up through their parents, so the base
   * scope will be the outer scope of the new klass.
   */
  function create_scope(base, klass, id) {
    var const_alloc   = function() {};
    var const_scope   = const_alloc.prototype = new base.constructor();
    klass._scope      = const_scope;
    const_scope.base  = klass;
    const_scope.constructor = const_alloc;

    if (id) {
      base[id] = base.constructor[id] = klass;
    }
  }

  Opal.klass = function(base, superklass, id, constructor) {
    var klass;

    if (!base._isClass) {
      base = base._klass;
    }

    if (superklass === null) {
      superklass = ObjectClass;
    }

    if ($hasOwn.call(base._scope, id)) {
      klass = base._scope[id];

      if (!klass._isClass) {
        throw Opal.TypeError.$new(id + " is not a class");
      }

      if (superklass !== klass._super && superklass !== ObjectClass) {
        throw Opal.TypeError.$new("superclass mismatch for class " + id);
      }
    }
    else {
      klass = boot_class(superklass, constructor);

      klass._name = (base === ObjectClass ? id : base._name + '::' + id);

      create_scope(base._scope, klass);

      base[id] = base._scope[id] = klass;

      if (superklass.$inherited) {
        superklass.$inherited(klass);
      }
    }

    return klass;
  };

  // Define new module (or return existing module)
  Opal.module = function(base, id, constructor) {
    var klass;

    if (!base._isClass) {
      base = base._klass;
    }

    if ($hasOwn.call(base._scope, id)) {
      klass = base._scope[id];

      if (!klass._mod$ && klass !== ObjectClass) {
        throw Opal.TypeError.$new(id + " is not a module")
      }
    }
    else {
      klass = boot_class(ClassClass, constructor);
      klass._name = (base === ObjectClass ? id : base._name + '::' + id);
      klass._mod$ = true;

      klass._included_in = [];

      create_scope(base._scope, klass, id);
    }

    return klass;
  };

  // Boot a base class (makes instances).
  var boot_defclass = function(id, constructor, superklass) {
    if (superklass) {
      var ctor           = function() {};
          ctor.prototype = superklass.prototype;

      constructor.prototype = new ctor();
    }

    var prototype = constructor.prototype;

    prototype.constructor = constructor;

    return constructor;
  };

  // Boot the actual (meta?) classes of core classes
  var boot_makemeta = function(id, klass, superklass) {
    function RubyClass() {
      this._id = unique_id++;
    };

    var ctor            = function() {};
        ctor.prototype  = superklass.prototype;

    RubyClass.prototype = new ctor();

    var prototype         = RubyClass.prototype;
    prototype._alloc      = klass;
    prototype._isClass    = true;
    prototype._name       = id;
    prototype._super      = superklass;
    prototype.constructor = RubyClass;
    prototype._methods    = [];

    var result = new RubyClass();
    klass.prototype._klass = result;
    result._proto = klass.prototype;

    Opal[id] = result;

    return result;
  };

  // Create generic class with given superclass.
  var boot_class = Opal.boot = function(superklass, constructor) {
    // instances
    var ctor = function() {};
        ctor.prototype = superklass._proto;

    constructor.prototype = new ctor();
    var prototype = constructor.prototype;

    prototype.constructor = constructor;

    // class itself
    function OpalClass() {
      this._id = unique_id++;
    };

    var mtor = function() {};
        mtor.prototype = superklass.constructor.prototype;

    OpalClass.prototype = new mtor();

    prototype = OpalClass.prototype;
    prototype._alloc = constructor;
    prototype._isClass = true;
    prototype.constructor = OpalClass;
    prototype._super = superklass;
    prototype._methods = [];

    var result = new OpalClass();
    constructor.prototype._klass = result;

    result._proto = constructor.prototype;

    return result;

    return constructor;
  };

  var bridge_class = function(name, constructor) {
    var klass = boot_class(ObjectClass, constructor);
    var i, length, m;

    constructor.prototype.constructor = constructor;

    constructor._super        = Object;
    constructor.constructor   = Class;
    constructor._methods      = [];

    bridged_classes.push(klass);

    var table = ObjectClass._proto, methods = ObjectClass._methods;

    for (i = 0, length = methods.length; i < length; i++) {
      m = methods[i];
      constructor.prototype[m] = table[m];
    }

    klass._name = name;
    create_scope(Opal, klass, name);

    return klass;
  };

  Opal.puts = function(a) { console.log(a); };

  Opal.add_stubs = function(stubs) {
    for (var i = 0, length = stubs.length; i < length; i++) {
      var stub = stubs[i];

      if (!BasicObject.prototype[stub]) {
        BasicObject.prototype[stub] = true;
        add_stub_for(BasicObject.prototype, stub);
      }
    }
  };

  function add_stub_for(prototype, stub) {
    function method_missing_stub() {
      this.$method_missing._p = method_missing_stub._p;
      method_missing_stub._p = null;

      return this.$method_missing.apply(this, [stub.slice(1)].concat($slice.call(arguments)));
    }

    method_missing_stub.rb_stub = true;
    prototype[stub] = method_missing_stub;
  }

  Opal.add_stub_for = add_stub_for;

  // Const missing dispatcher
  Opal.cm = function(name) {
    return this.base.$const_missing(name);
  };

  // Arity count error dispatcher
  Opal.ac = function(actual, expected, object, meth) {
    var inspect = ((typeof(object) !== 'function') ? object.constructor._name + '#' : object._name + '.') + meth;
    var msg = '[' + inspect + '] wrong number of arguments(' + actual + ' for ' + expected + ')';
    throw Opal.ArgumentError.$new(msg);
  };

  // Super dispatcher
  Opal.dispatch_super = function(obj, jsid, args, iter, defs) {
    var dispatcher;

    if (defs) {
      dispatcher = obj._isClass ? defs._super : obj._klass._proto;
    }
    else {
      dispatcher = obj._isClass ? obj._klass : obj._klass._super._proto;
    }

    dispatcher = dispatcher['$' + jsid];
    dispatcher._p = iter;

    return dispatcher.apply(obj, args);
  };

  // return helper
  Opal.$return = function(val) {
    Opal.returner.$v = val;
    throw Opal.returner;
  };

  // handles yield calls for 1 yielded arg
  Opal.$yield1 = function(block, arg) {
    if (typeof(block) !== "function") {
      throw Opal.LocalJumpError.$new("no block given");
    }

    if (block.length > 1) {
      if (arg._isArray) {
        return block.apply(null, arg);
      }
      else {
        return block(arg);
      }
    }
    else {
      return block(arg);
    }
  };

  // handles yield for > 1 yielded arg
  Opal.$yieldX = function(block, args) {
    if (block.length > 1 && args.length == 1) {
      if (args[0]._isArray) {
        return block.apply(null, args[0]);
      }
    }

    return block.apply(null, args);
  };

  /*
    Call a ruby method on a ruby object with some arguments:

      var my_array = [1, 2, 3, 4]
      Opal.send(my_array, 'length')     # => 4
      Opal.send(my_array, 'reverse!')   # => [4, 3, 2, 1]

    A missing method will be forwarded to the object via
    method_missing.

    The result of either call with be returned.

    @param [Object] recv the ruby object
    @param [String] mid ruby method to call
  */
  Opal.send = function(recv, mid) {
    var args = $slice.call(arguments, 2),
        func = recv['$' + mid];

    if (func) {
      return func.apply(recv, args);
    }

    return recv.$method_missing.apply(recv, [mid].concat(args));
  };

  Opal.block_send = function(recv, mid, block) {
    var args = $slice.call(arguments, 3),
        func = recv['$' + mid];

    if (func) {
      func._p = block;
      return func.apply(recv, args);
    }

    return recv.$method_missing.apply(recv, [mid].concat(args));
  };

  /**
   * Donate methods for a class/module
   */
  Opal.donate = function(klass, defined, indirect) {
    var methods = klass._methods, included_in = klass._included_in;

    // if (!indirect) {
      klass._methods = methods.concat(defined);
    // }

    if (included_in) {
      for (var i = 0, length = included_in.length; i < length; i++) {
        var includee = included_in[i];
        var dest = includee._proto;

        for (var j = 0, jj = defined.length; j < jj; j++) {
          var method = defined[j];
          dest[method] = klass._proto[method];
        }

        if (includee._included_in) {
          Opal.donate(includee, defined, true);
        }
      }
    }
  };

  // Initialization
  // --------------

  // Constructors for *instances* of core objects
  boot_defclass('BasicObject', BasicObject);
  boot_defclass('Object', Object, BasicObject);
  boot_defclass('Module', Module, Object);
  boot_defclass('Class', Class, Module);

  // Constructors for *classes* of core objects
  var BasicObjectClass = boot_makemeta('BasicObject', BasicObject, Class);
  var ObjectClass      = boot_makemeta('Object', Object, BasicObjectClass.constructor);
  var ModuleClass      = boot_makemeta('Module', Module, ObjectClass.constructor);
  var ClassClass       = boot_makemeta('Class', Class, ModuleClass.constructor);

  // Fix booted classes to use their metaclass
  BasicObjectClass._klass = ClassClass;
  ObjectClass._klass = ClassClass;
  ModuleClass._klass = ClassClass;
  ClassClass._klass = ClassClass;

  // Fix superclasses of booted classes
  BasicObjectClass._super = null;
  ObjectClass._super = BasicObjectClass;
  ModuleClass._super = ObjectClass;
  ClassClass._super = ModuleClass;

  // Defines methods onto Object (which are then donated to bridged classes)
  ObjectClass._defn = function (mid, body) {
    this._proto[mid] = body;
    Opal.donate(this, [mid]);
  };

  var bridged_classes = ObjectClass._included_in = [];

  Opal.base = ObjectClass;
  BasicObjectClass._scope = ObjectClass._scope = Opal;
  Opal.Kernel = ObjectClass;

  create_scope(Opal, ModuleClass);
  create_scope(Opal, ClassClass);

  ObjectClass._proto.toString = function() {
    return this.$to_s();
  };

  ClassClass._proto._defn = function(mid, body) { this._proto[mid] = body; };

  Opal.top = new ObjectClass._alloc();

  Opal.klass(ObjectClass, ObjectClass, 'NilClass', NilClass);

  var nil = Opal.nil = new NilClass;
  nil.call = nil.apply = function() { throw Opal.LocalJumpError.$new('no block given'); };

  Opal.breaker  = new Error('unexpected break');
  Opal.returner = new Error('unexpected return');

  bridge_class('Array', Array);
  bridge_class('Boolean', Boolean);
  bridge_class('Numeric', Number);
  bridge_class('String', String);
  bridge_class('Proc', Function);
  bridge_class('Exception', Error);
  bridge_class('Regexp', RegExp);
  bridge_class('Time', Date);

  TypeError._super = Error;
}).call(this);
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$attr_reader', '$attr_writer', '$=~', '$raise', '$const_missing', '$to_str', '$name', '$append_features', '$included']);
  return (function($base, $super){
    function Module() {};
    Module = $klass($base, $super, "Module", Module);

    var def = Module._proto, $scope = Module._scope, TMP_1, TMP_2, TMP_3;

    Module.constructor.prototype['$new'] = TMP_1 = function() {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;

      function AnonModule(){}
      var klass = Opal.boot(Module, AnonModule);
      klass._name = nil;
      klass._scope = Module._scope;
      klass._klass = Module;

      if (block !== nil) {
        var block_self = block._s;
        block._s = null;
        block.call(klass);
        block._s = block_self;
      }

      return klass;

    };

    def['$==='] = function(object) {


      if (object == null) {
        return false;
      }

      var search = object._klass;

      while (search) {
        if (search === this) {
          return true;
        }

        search = search._super;
      }

      return false;

    };

    def.$alias_method = function(newname, oldname) {

      this._proto['$' + newname] = this._proto['$' + oldname];
      return this;
    };

    def.$alias_native = function(mid, jsid) {

      return this._proto['$' + mid] = this._proto[jsid];
    };

    def.$ancestors = function() {


      var parent = this,
          result = [];

      while (parent) {
        result.push(parent);
        parent = parent._super;
      }

      return result;
    ;
    };

    def.$append_features = function(klass) {


      var module = this;

      if (!klass.$included_modules) {
        klass.$included_modules = [];
      }

      for (var idx = 0, length = klass.$included_modules.length; idx < length; idx++) {
        if (klass.$included_modules[idx] === module) {
          return;
        }
      }

      klass.$included_modules.push(module);

      if (!module._included_in) {
        module._included_in = [];
      }

      module._included_in.push(klass);

      var donator   = module._proto,
          prototype = klass._proto,
          methods   = module._methods;

      for (var i = 0, length = methods.length; i < length; i++) {
        var method = methods[i];
        prototype[method] = donator[method];
      }

      // if (prototype._smethods) {
      //  prototype._smethods.push.apply(prototype._smethods, methods);
      //}

      if (klass._included_in) {
        $opal.donate(klass, methods.slice(), true);
      }
    ;
      return this;
    };

    def.$attr_accessor = function(names) {
      var $a, $b;names = $slice.call(arguments, 0);
      ($a = this).$attr_reader.apply($a, [].concat(names));
      return ($b = this).$attr_writer.apply($b, [].concat(names));
    };

    def.$attr_reader = function(names) {
      names = $slice.call(arguments, 0);

      var proto = this._proto, cls = this;
      for (var i = 0, length = names.length; i < length; i++) {
        (function(name) {
          proto[name] = nil;
          var func = function() { return this[name] };

          if (cls._isSingleton) {
            proto.constructor.prototype['$' + name] = func;
          }
          else {
            proto['$' + name] = func;
          }
        })(names[i]);
      }
    ;
      return nil;
    };

    def.$attr_writer = function(names) {
      names = $slice.call(arguments, 0);

      var proto = this._proto, cls = this;
      for (var i = 0, length = names.length; i < length; i++) {
        (function(name) {
          proto[name] = nil;
          var func = function(value) { return this[name] = value; };

          if (cls._isSingleton) {
            proto.constructor.prototype['$' + name + '='] = func;
          }
          else {
            proto['$' + name + '='] = func;
          }
        })(names[i]);
      }
    ;
      return nil;
    };

    def.$attr = def.$attr_accessor;

    def.$constants = function() {


      var result = [];
      var name_re = /^[A-Z][A-Za-z0-9_]+$/;
      var scopes = [this._scope];
      var own_only;
      if (this === Opal.Class || this === Opal.Module) {
        own_only = false;
      }
      else {
        own_only = true;
        var parent = this._super;
        while (parent && (parent !== Opal.Object)) {
          scopes.push(parent._scope);
          parent = parent._super;
        }
      }
      for (var i = 0, len = scopes.length; i < len; i++) {
        var scope = scopes[i];
        for (name in scope) {
          if ((!own_only || scope.hasOwnProperty(name)) && name_re.test(name)) {
            result.push(name);
          }
        }
      }

      return result;
    ;
    };

    def['$const_defined?'] = function(name, inherit) {
      var $a;if (inherit == null) {
        inherit = true
      }
      if (($a = name['$=~'](/^[A-Z]\w+$/)) === false || $a === nil) {
        this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "wrong constant name " + (name))
      };

      scopes = [this._scope];
      if (inherit || this === Opal.Object) {
        var parent = this._super;
        while (parent !== Opal.BasicObject) {
          scopes.push(parent._scope);
          parent = parent._super;
        }
      }

      for (var i = 0, len = scopes.length; i < len; i++) {
        if (scopes[i].hasOwnProperty(name)) {
          return true;
        }
      }

      return false;
    ;
    };

    def.$const_get = function(name, inherit) {
      var $a;if (inherit == null) {
        inherit = true
      }
      if (($a = name['$=~'](/^[A-Z]\w+$/)) === false || $a === nil) {
        this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "wrong constant name " + (name))
      };

      var scopes = [this._scope];
      if (inherit || this == Opal.Object) {
        var parent = this._super;
        while (parent !== Opal.BasicObject) {
          scopes.push(parent._scope);
          parent = parent._super;
        }
      }

      for (var i = 0, len = scopes.length; i < len; i++) {
        if (scopes[i].hasOwnProperty(name)) {
          return scopes[i][name];
        }
       }

      return this.$const_missing(name);
    ;
    };

    def.$const_missing = function(const$) {
      var $a, name = nil;
      name = this._name;
      return this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "uninitialized constant " + (name) + "::" + (const$));
    };

    def.$const_set = function(name, value) {
      var $a;
      if (($a = name['$=~'](/^[A-Z]\w+$/)) === false || $a === nil) {
        this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "wrong constant name " + (name))
      };
      try {
        name = name.$to_str()
      } catch ($err) {
      if (true){
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "conversion with #to_str failed")}else { throw $err; }
      };

      this._scope[name] = value;

      if (value._isClass && value._name === nil) {
        value._name = this.$name() + '::' + name;
      }

      return value
    ;
    };

    def.$define_method = TMP_2 = function(name, method) {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;

      if (method) {
        block = method;
      }

      if (block === nil) {
        throw new Error("no block given");
      }

      var jsid    = '$' + name;
      block._jsid = jsid;
      block._sup  = this._proto[jsid];
      block._s    = null;

      this._proto[jsid] = block;
      $opal.donate(this, [jsid]);

      return null;

    };

    def.$include = function(mods) {
      mods = $slice.call(arguments, 0);

      var i = mods.length - 1, mod;
      while (i >= 0) {
        mod = mods[i];
        i--;

        if (mod === this) {
          continue;
        }

        (mod).$append_features(this);
        (mod).$included(this);
      }

      return this;

    };

    def.$instance_methods = function(include_super) {
      if (include_super == null) {
        include_super = false
      }

      var methods = [], proto = this._proto;

      for (var prop in this._proto) {
        if (!include_super && !proto.hasOwnProperty(prop)) {
          continue;
        }

        if (prop.charAt(0) === '$') {
          methods.push(prop.substr(1));
        }
      }

      return methods;
    ;
    };

    def.$included = function(mod) {

      return nil;
    };

    def.$module_eval = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;

      if (block === nil) {
        throw new Error("no block given");
      }

      var block_self = block._s, result;

      block._s = null;
      result = block.call(this);
      block._s = block_self;

      return result;

    };

    def.$class_eval = def.$module_eval;

    def['$method_defined?'] = function(method) {


      var body = this._proto['$' + method];
      return (!!body) && !body.rb_stub;
    ;
    };

    def.$module_function = function(methods) {
      methods = $slice.call(arguments, 0);

      for (var i = 0, length = methods.length; i < length; i++) {
        var meth = methods[i], func = this._proto['$' + meth];

        this.constructor.prototype['$' + meth] = func;
      }

      return this;

    };

    def.$name = function() {

      return this._name;
    };

    def.$public = function() {

      return nil;
    };

    def.$private = def.$public;

    def.$protected = def.$public;

    def['$public_method_defined?'] = def['$method_defined?'];

    def.$remove_const = function(name) {


      var old = this._scope[name];
      delete this._scope[name];
      return old;
    ;
    };

    def.$to_s = function() {

      return this._name;
    };

    def.$undef_method = function(symbol) {

      $opal.add_stub_for(this._proto, "$" + symbol);
      return this;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/module.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$allocate']);
  return (function($base, $super){
    function Class() {};
    Class = $klass($base, $super, "Class", Class);

    var def = Class._proto, $scope = Class._scope, TMP_1, TMP_2;

    Class.constructor.prototype['$new'] = TMP_1 = function(sup) {
      var $a, $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;if (sup == null) {
        sup = (($a = $scope.Object) == null ? $opal.cm("Object") : $a)
      }

      function AnonClass(){};
      var klass   = Opal.boot(sup, AnonClass)
      klass._name = nil;
      klass._scope = sup._scope;

      sup.$inherited(klass);

      if (block !== nil) {
        var block_self = block._s;
        block._s = null;
        block.call(klass);
        block._s = block_self;
      }

      return klass;

    };

    def.$allocate = function() {


      var obj = new this._alloc;
      obj._id = Opal.uid();
      return obj;
    ;
    };

    def.$inherited = function(cls) {

      return nil;
    };

    def.$new = TMP_2 = function(args) {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;args = $slice.call(arguments, 0);

      var obj = this.$allocate();
      obj._id = Opal.uid();

      obj.$initialize._p = block;
      obj.$initialize.apply(obj, args);
      return obj;
    ;
    };

    def.$superclass = function() {

      return this._super || nil;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/class.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$raise']);
  return (function($base, $super){
    function BasicObject() {};
    BasicObject = $klass($base, $super, "BasicObject", BasicObject);

    var def = BasicObject._proto, $scope = BasicObject._scope, TMP_1, TMP_2, TMP_3, TMP_4;

    def.$initialize = function() {

      return nil;
    };

    def['$=='] = function(other) {

      return this === other;
    };

    def.$__send__ = TMP_1 = function(symbol, args) {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;args = $slice.call(arguments, 1);

      var func = this['$' + symbol]

      if (func) {
        if (block !== nil) { func._p = block; }
        return func.apply(this, args);
      }

      if (block !== nil) { this.$method_missing._p = block; }
      return this.$method_missing.apply(this, [symbol].concat(args));
    ;
    };

    def['$eql?'] = def['$=='];

    def['$equal?'] = def['$=='];

    def.$instance_eval = TMP_2 = function() {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;

      if (block === nil) {
        throw new Error("no block given");
      }

      var block_self = block._s, result;

      block._s = null;
      result = block.call(this, this);
      block._s = block_self;

      return result;
    ;
    };

    def.$instance_exec = TMP_3 = function(args) {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;args = $slice.call(arguments, 0);

      if (block === nil) {
        throw new Error("no block given");
      }

      var block_self = block._s, result;

      block._s = null;
      result = block.apply(this, args);
      block._s = block_self;

      return result;

    };

    def.$method_missing = TMP_4 = function(symbol, args) {
      var $a, $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;args = $slice.call(arguments, 1);
      return (($a = $scope.Kernel) == null ? $opal.cm("Kernel") : $a).$raise((($a = $scope.NoMethodError) == null ? $opal.cm("NoMethodError") : $a), "undefined method `" + (symbol) + "' for BasicObject instance");
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/basic_object.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $gvars = $opal.gvars;

  $opal.add_stubs(['$raise', '$inspect', '$native?', '$respond_to?', '$to_ary', '$to_a', '$allocate', '$class', '$new', '$include', '$singleton_class', '$to_i', '$to_s', '$to_f', '$*', '$>', '$length', '$shift', '$print', '$format', '$puts', '$each', '$<=', '$[]', '$is_a?', '$rand']);
  return (function($base){
    function Kernel() {};
    Kernel = $module($base, "Kernel", Kernel);
    var def = Kernel._proto, $scope = Kernel._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_7;

    def.$initialize = def.$initialize;

    def['$=='] = def['$=='];

    def.$__send__ = def.$__send__;

    def['$eql?'] = def['$eql?'];

    def['$equal?'] = def['$equal?'];

    def.$instance_eval = def.$instance_eval;

    def.$instance_exec = def.$instance_exec;

    def.$method_missing = TMP_1 = function(symbol, args) {
      var $a, $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;args = $slice.call(arguments, 1);
      return this.$raise((($a = $scope.NoMethodError) == null ? $opal.cm("NoMethodError") : $a), "undefined method `" + (symbol) + "' for " + (this.$inspect()));
    };

    def['$=~'] = function(obj) {

      return false;
    };

    def['$==='] = function(other) {

      return this == other;
    };

    def.$method = function(name) {
      var $a;

      var recv = this,
          meth = recv['$' + name],
          func = function() {
            return meth.apply(recv, $slice.call(arguments, 0));
          };

      if (!meth) {
        this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a));
      }

      func._klass = (($a = $scope.Method) == null ? $opal.cm("Method") : $a);
      return func;
    ;
    };

    def.$methods = function(all) {
      if (all == null) {
        all = true
      }

      var methods = [];
      for(var k in this) {
        if(k[0] == "$" && typeof (this)[k] === "function") {
          if(all === false || all === nil) {
            if(!Object.hasOwnProperty.call(this, k)) {
              continue;
            }
          }
          methods.push(k.substr(1));
        }
      }
      return methods;
    ;
    };

    def.$Array = function(object, func, length) {
      if (length == null) {
        length = "length"
      }

      if (object == null || object === nil) {
        return [];
      }
      else if (this['$native?'](object) && object[length] != null) {
        var result = [];

        for (var i = 0, length = object[length]; i < length; i++) {
          result.push(func ? object[func](i) : object[i]);
        }

        return result;
      }
      else if (object['$respond_to?']("to_ary")) {
        return object.$to_ary();
      }
      else if (object['$respond_to?']("to_a")) {
        return object.$to_a();
      }
      else {
        return [object];
      }
    ;
    };

    def.$class = function() {

      return this._klass;
    };

    def.$define_singleton_method = TMP_2 = function(name) {
      var $iter = TMP_2._p, body = $iter || nil;TMP_2._p = null;

      if (body === nil) {
        throw new Error("no block given");
      }

      var jsid   = '$' + name;
      body._jsid = jsid;
      body._sup  = this[jsid];
      body._s    = null;

      this[jsid] = body;

      return this;

    };

    def.$dup = function() {

      return this.$class().$allocate();
    };

    def.$enum_for = function(method, args) {
      var $a, $b;if (method == null) {
        method = "each"
      }args = $slice.call(arguments, 1);
      return ($a = (($b = $scope.Enumerator) == null ? $opal.cm("Enumerator") : $b)).$new.apply($a, [this, method].concat(args));
    };

    def['$equal?'] = function(other) {

      return this === other;
    };

    def.$extend = function(mods) {
      mods = $slice.call(arguments, 0);

      for (var i = 0, length = mods.length; i < length; i++) {
        this.$singleton_class().$include(mods[i]);
      }

      return this;

    };

    def.$format = function(format, args) {
      args = $slice.call(arguments, 1);

      var idx = 0;
      return format.replace(/%(\d+\$)?([-+ 0]*)(\d*|\*(\d+\$)?)(?:\.(\d*|\*(\d+\$)?))?([cspdiubBoxXfgeEG])|(%%)/g, function(str, idx_str, flags, width_str, w_idx_str, prec_str, p_idx_str, spec, escaped) {
        if (escaped) {
          return '%';
        }

        var width,
        prec,
        is_integer_spec = ("diubBoxX".indexOf(spec) != -1),
        is_float_spec = ("eEfgG".indexOf(spec) != -1),
        prefix = '',
        obj;

        if (width_str === undefined) {
          width = undefined;
        } else if (width_str.charAt(0) == '*') {
          var w_idx = idx++;
          if (w_idx_str) {
            w_idx = parseInt(w_idx_str, 10) - 1;
          }
          width = (args[w_idx]).$to_i();
        } else {
          width = parseInt(width_str, 10);
        }
        if (!prec_str) {
          prec = is_float_spec ? 6 : undefined;
        } else if (prec_str.charAt(0) == '*') {
          var p_idx = idx++;
          if (p_idx_str) {
            p_idx = parseInt(p_idx_str, 10) - 1;
          }
          prec = (args[p_idx]).$to_i();
        } else {
          prec = parseInt(prec_str, 10);
        }
        if (idx_str) {
          idx = parseInt(idx_str, 10) - 1;
        }
        switch (spec) {
        case 'c':
          obj = args[idx];
          if (obj._isString) {
            str = obj.charAt(0);
          } else {
            str = String.fromCharCode((obj).$to_i());
          }
          break;
        case 's':
          str = (args[idx]).$to_s();
          if (prec !== undefined) {
            str = str.substr(0, prec);
          }
          break;
        case 'p':
          str = (args[idx]).$inspect();
          if (prec !== undefined) {
            str = str.substr(0, prec);
          }
          break;
        case 'd':
        case 'i':
        case 'u':
          str = (args[idx]).$to_i().toString();
          break;
        case 'b':
        case 'B':
          str = (args[idx]).$to_i().toString(2);
          break;
        case 'o':
          str = (args[idx]).$to_i().toString(8);
          break;
        case 'x':
        case 'X':
          str = (args[idx]).$to_i().toString(16);
          break;
        case 'e':
        case 'E':
          str = (args[idx]).$to_f().toExponential(prec);
          break;
        case 'f':
          str = (args[idx]).$to_f().toFixed(prec);
          break;
        case 'g':
        case 'G':
          str = (args[idx]).$to_f().toPrecision(prec);
          break;
        }
        idx++;
        if (is_integer_spec || is_float_spec) {
          if (str.charAt(0) == '-') {
            prefix = '-';
            str = str.substr(1);
          } else {
            if (flags.indexOf('+') != -1) {
              prefix = '+';
            } else if (flags.indexOf(' ') != -1) {
              prefix = ' ';
            }
          }
        }
        if (is_integer_spec && prec !== undefined) {
          if (str.length < prec) {
            str = "0"['$*'](prec - str.length) + str;
          }
        }
        var total_len = prefix.length + str.length;
        if (width !== undefined && total_len < width) {
          if (flags.indexOf('-') != -1) {
            str = str + " "['$*'](width - total_len);
          } else {
            var pad_char = ' ';
            if (flags.indexOf('0') != -1) {
              str = "0"['$*'](width - total_len) + str;
            } else {
              prefix = " "['$*'](width - total_len) + prefix;
            }
          }
        }
        var result = prefix + str;
        if ('XEG'.indexOf(spec) != -1) {
          result = result.toUpperCase();
        }
        return result;
      });

    };

    def.$hash = function() {

      return this._id;
    };

    def.$inspect = function() {

      return this.$to_s();
    };

    def['$instance_of?'] = function(klass) {

      return this._klass === klass;
    };

    def['$instance_variable_defined?'] = function(name) {

      return this.hasOwnProperty(name.substr(1));
    };

    def.$instance_variable_get = function(name) {


      var ivar = this[name.substr(1)];

      return ivar == null ? nil : ivar;
    ;
    };

    def.$instance_variable_set = function(name, value) {

      return this[name.substr(1)] = value;
    };

    def.$instance_variables = function() {


      var result = [];

      for (var name in this) {
        if (name.charAt(0) !== '$') {
          result.push(name);
        }
      }

      return result;

    };

    def.$Integer = function(str) {

      return parseInt(str);
    };

    def['$is_a?'] = function(klass) {


      var search = this._klass;

      while (search) {
        if (search === klass) {
          return true;
        }

        search = search._super;
      }

      return false;
    ;
    };

    def['$kind_of?'] = def['$is_a?'];

    def.$lambda = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      return block;
    };

    def.$loop = TMP_4 = function() {
      var $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      while (true) {;
      if ($opal.$yieldX(block, []) === $breaker) return $breaker.$v;
      };
      return this;
    };

    def['$nil?'] = function() {

      return false;
    };

    def.$object_id = function() {

      return this._id || (this._id = Opal.uid());
    };

    def.$printf = function(args) {
      var $a, fmt = nil;args = $slice.call(arguments, 0);
      if (args.$length()['$>'](0)) {
        fmt = args.$shift();
        this.$print(($a = this).$format.apply($a, [fmt].concat(args)));
      };
      return nil;
    };

    def.$proc = TMP_5 = function() {
      var $a, $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;

      if (block === nil) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "no block given");
      }
      block.is_lambda = false;
      return block;
    ;
    };

    def.$puts = function(strs) {
      var $a;strs = $slice.call(arguments, 0);
      return ($a = $gvars["stdout"]).$puts.apply($a, [].concat(strs));
    };

    def.$p = function(args) {
      var TMP_6, $a, $b;args = $slice.call(arguments, 0);
      ($a = ($b = args).$each, $a._p = (TMP_6 = function(obj) {

        var self = TMP_6._s || this;
        if (obj == null) obj = nil;

        return $gvars["stdout"].$puts(obj.$inspect())
      }, TMP_6._s = this, TMP_6), $a).call($b);
      if (args.$length()['$<='](1)) {
        return args['$[]'](0)
      } else {
        return args
      };
    };

    def.$print = def.$puts;

    def.$raise = function(exception, string) {
      var $a;if (exception == null) {
        exception = ""
      }

      if (typeof(exception) === 'string') {
        exception = (($a = $scope.RuntimeError) == null ? $opal.cm("RuntimeError") : $a).$new(exception);
      }
      else if (!exception['$is_a?']((($a = $scope.Exception) == null ? $opal.cm("Exception") : $a))) {
        exception = exception.$new(string);
      }

      throw exception;
    ;
    };

    def.$rand = function(max) {


      if(!max) {
        return Math.random();
      } else {
        if (max._isRange) {
          var arr = max.$to_a();
          return arr[this.$rand(arr.length)];
        } else {
          return Math.floor(Math.random() * Math.abs(parseInt(max)));
        }
      }

    };

    def['$respond_to?'] = function(name) {


      var body = this['$' + name];
      return (!!body) && !body.rb_stub;
    ;
    };

    def.$send = def.$__send__;

    def.$public_send = def.$__send__;

    def.$singleton_class = function() {


      if (this._isClass) {
        if (this._singleton) {
          return this._singleton;
        }

        var meta = new $opal.Class._alloc;
        meta._klass = $opal.Class;
        this._singleton = meta;
        // FIXME - is this right? (probably - methods defined on
        // class' singleton should also go to subclasses?)
        meta._proto = this.constructor.prototype;
        meta._isSingleton = true;

        meta._scope = this._scope;

        return meta;
      }

      if (this._isClass) {
        return this._klass;
      }

      if (this._singleton) {
        return this._singleton;
      }

      else {
        var orig_class = this._klass,
            class_id   = "#<Class:#<" + orig_class._name + ":" + orig_class._id + ">>";

        var Singleton = function () {};
        var meta = Opal.boot(orig_class, Singleton);
        meta._name = class_id;

        meta._proto = this;
        this._singleton = meta;
        meta._klass = orig_class._klass;
        meta._scope = orig_class._scope;

        return meta;
      }
    ;
    };

    def.$sprintf = def.$format;

    def.$String = function(str) {

      return String(str);
    };

    def.$tap = TMP_7 = function() {
      var $iter = TMP_7._p, block = $iter || nil;TMP_7._p = null;
      if ($opal.$yield1(block, this) === $breaker) return $breaker.$v;
      return this;
    };

    def.$to_proc = function() {

      return this;
    };

    def.$to_s = function() {

      return "#<" + this._klass._name + ":" + this._id + ">";;
    };

    def.$to_str = def.$to_s;

    def.$freeze = function() {

      this.___frozen___ = true;
      return this;
    };

    def['$frozen?'] = function() {
      var $a;
      if (this.___frozen___ == null) this.___frozen___ = nil;

      return ((($a = this.___frozen___) !== false && $a !== nil) ? $a : false);
    };
    ;$opal.donate(Kernel, ["$initialize", "$==", "$__send__", "$eql?", "$equal?", "$instance_eval", "$instance_exec", "$method_missing", "$=~", "$===", "$method", "$methods", "$Array", "$class", "$define_singleton_method", "$dup", "$enum_for", "$equal?", "$extend", "$format", "$hash", "$inspect", "$instance_of?", "$instance_variable_defined?", "$instance_variable_get", "$instance_variable_set", "$instance_variables", "$Integer", "$is_a?", "$kind_of?", "$lambda", "$loop", "$nil?", "$object_id", "$printf", "$proc", "$puts", "$p", "$print", "$raise", "$rand", "$respond_to?", "$send", "$public_send", "$singleton_class", "$sprintf", "$String", "$tap", "$to_proc", "$to_s", "$to_str", "$freeze", "$frozen?"]);
  })(self)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/kernel.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$raise']);
  return (function($base, $super){
    function NilClass() {};
    NilClass = $klass($base, $super, "NilClass", NilClass);

    var def = NilClass._proto, $scope = NilClass._scope;

    def['$&'] = function(other) {

      return false;
    };

    def['$|'] = function(other) {

      return other !== false && other !== nil;
    };

    def['$^'] = function(other) {

      return other !== false && other !== nil;
    };

    def['$=='] = function(other) {

      return other === nil;
    };

    def.$dup = function() {
      var $a;
      return this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a));
    };

    def.$inspect = function() {

      return "nil";
    };

    def['$nil?'] = function() {

      return true;
    };

    def.$singleton_class = function() {
      var $a;
      return (($a = $scope.NilClass) == null ? $opal.cm("NilClass") : $a);
    };

    def.$to_a = function() {

      return [];
    };

    def.$to_h = function() {

      return $opal.hash();
    };

    def.$to_i = function() {

      return 0;
    };

    def.$to_f = def.$to_i;

    def.$to_n = function() {

      return null;
    };

    def.$to_s = function() {

      return "";
    };

    def.$object_id = function() {
      var $a;
      return (($a = $scope.NilClass) == null ? $opal.cm("NilClass") : $a)._id || ((($a = $scope.NilClass) == null ? $opal.cm("NilClass") : $a)._id = $opal.uid());
    };

    return def.$hash = def.$object_id;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/nil_class.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs([]);
  (function($base, $super){
    function Boolean() {};
    Boolean = $klass($base, $super, "Boolean", Boolean);

    var def = Boolean._proto, $scope = Boolean._scope;

    def._isBoolean = true;

    def['$&'] = function(other) {

      return (this == true) ? (other !== false && other !== nil) : false;
    };

    def['$|'] = function(other) {

      return (this == true) ? true : (other !== false && other !== nil);
    };

    def['$^'] = function(other) {

      return (this == true) ? (other === false || other === nil) : (other !== false && other !== nil);
    };

    def['$=='] = function(other) {

      return (this == true) === other.valueOf();
    };

    def.$singleton_class = def.$class;

    def.$to_s = function() {

      return (this == true) ? 'true' : 'false';
    };

    def.$to_n = function() {

      return this.valueOf();
    };

    return nil;
  })(self, null);
  $scope.TrueClass = (($a = $scope.Boolean) == null ? $opal.cm("Boolean") : $a);
  return $scope.FalseClass = (($a = $scope.Boolean) == null ? $opal.cm("Boolean") : $a);
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/boolean.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$attr_reader', '$name', '$class']);
  (function($base, $super){
    function Exception() {};
    Exception = $klass($base, $super, "Exception", Exception);

    var def = Exception._proto, $scope = Exception._scope;
    def.message = nil;

    Exception.$attr_reader("message");

    Exception.constructor.prototype['$new'] = function(message) {
      if (message == null) {
        message = ""
      }

      var err = new Error(message);
      err._klass = this;
      err.name = this._name;
      return err;

    };

    def.$backtrace = function() {


      var backtrace = this.stack;

      if (typeof(backtrace) === 'string') {
        return backtrace.split("\n").slice(0, 15);
      }
      else if (backtrace) {
        return backtrace.slice(0, 15);
      }

      return [];
    ;
    };

    def.$inspect = function() {

      return "#<" + (this.$class().$name()) + ": '" + (this.message) + "'>";
    };

    return def.$to_s = def.$message;
  })(self, null);
  (function($base, $super){
    function StandardError() {};
    StandardError = $klass($base, $super, "StandardError", StandardError);

    var def = StandardError._proto, $scope = StandardError._scope;

    return nil
  })(self, (($a = $scope.Exception) == null ? $opal.cm("Exception") : $a));
  (function($base, $super){
    function NameError() {};
    NameError = $klass($base, $super, "NameError", NameError);

    var def = NameError._proto, $scope = NameError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function NoMethodError() {};
    NoMethodError = $klass($base, $super, "NoMethodError", NoMethodError);

    var def = NoMethodError._proto, $scope = NoMethodError._scope;

    return nil
  })(self, (($a = $scope.NameError) == null ? $opal.cm("NameError") : $a));
  (function($base, $super){
    function RuntimeError() {};
    RuntimeError = $klass($base, $super, "RuntimeError", RuntimeError);

    var def = RuntimeError._proto, $scope = RuntimeError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function LocalJumpError() {};
    LocalJumpError = $klass($base, $super, "LocalJumpError", LocalJumpError);

    var def = LocalJumpError._proto, $scope = LocalJumpError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function TypeError() {};
    TypeError = $klass($base, $super, "TypeError", TypeError);

    var def = TypeError._proto, $scope = TypeError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function ArgumentError() {};
    ArgumentError = $klass($base, $super, "ArgumentError", ArgumentError);

    var def = ArgumentError._proto, $scope = ArgumentError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function IndexError() {};
    IndexError = $klass($base, $super, "IndexError", IndexError);

    var def = IndexError._proto, $scope = IndexError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function StopIteration() {};
    StopIteration = $klass($base, $super, "StopIteration", StopIteration);

    var def = StopIteration._proto, $scope = StopIteration._scope;

    return nil
  })(self, (($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a));
  (function($base, $super){
    function KeyError() {};
    KeyError = $klass($base, $super, "KeyError", KeyError);

    var def = KeyError._proto, $scope = KeyError._scope;

    return nil
  })(self, (($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a));
  (function($base, $super){
    function RangeError() {};
    RangeError = $klass($base, $super, "RangeError", RangeError);

    var def = RangeError._proto, $scope = RangeError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function IOError() {};
    IOError = $klass($base, $super, "IOError", IOError);

    var def = IOError._proto, $scope = IOError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function ScriptError() {};
    ScriptError = $klass($base, $super, "ScriptError", ScriptError);

    var def = ScriptError._proto, $scope = ScriptError._scope;

    return nil
  })(self, (($a = $scope.Exception) == null ? $opal.cm("Exception") : $a));
  (function($base, $super){
    function SyntaxError() {};
    SyntaxError = $klass($base, $super, "SyntaxError", SyntaxError);

    var def = SyntaxError._proto, $scope = SyntaxError._scope;

    return nil
  })(self, (($a = $scope.ScriptError) == null ? $opal.cm("ScriptError") : $a));
  (function($base, $super){
    function NotImplementedError() {};
    NotImplementedError = $klass($base, $super, "NotImplementedError", NotImplementedError);

    var def = NotImplementedError._proto, $scope = NotImplementedError._scope;

    return nil
  })(self, (($a = $scope.ScriptError) == null ? $opal.cm("ScriptError") : $a));
  return (function($base, $super){
    function SystemExit() {};
    SystemExit = $klass($base, $super, "SystemExit", SystemExit);

    var def = SystemExit._proto, $scope = SystemExit._scope;

    return nil
  })(self, (($a = $scope.Exception) == null ? $opal.cm("Exception") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/error.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, $gvars = $opal.gvars;

  $opal.add_stubs(['$new']);
  return (function($base, $super){
    function Regexp() {};
    Regexp = $klass($base, $super, "Regexp", Regexp);

    var def = Regexp._proto, $scope = Regexp._scope;

    def._isRegexp = true;

    Regexp.constructor.prototype['$escape'] = function(string) {

      return string.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\^\$\|]/g, '\\$&');
    };

    Regexp.constructor.prototype['$new'] = function(regexp, options) {

      return options? new RegExp(regexp, options) : new RegExp(regexp);
    };

    def['$=='] = function(other) {

      return other.constructor == RegExp && this.toString() === other.toString();
    };

    def['$==='] = function(str) {

      return this.test(str);
    };

    def['$=~'] = function(string) {
      var $a;

      var re = this;
      if (re.global) {
        // should we clear it afterwards too?
        re.lastIndex = 0;
      }
      else {
        // rewrite regular expression to add the global flag to capture pre/post match
        re = new RegExp(re.source, 'g' + (re.multiline ? 'm' : '') + (re.ignoreCase ? 'i' : ''));
      }

      var result = re.exec(string);

      if (result) {
        $gvars["~"] = (($a = $scope.MatchData) == null ? $opal.cm("MatchData") : $a).$new(re, result);
      }
      else {
        $gvars["~"] = $gvars["`"] = $gvars["'"] = nil;
      }

      return result ? result.index : nil;
    ;
    };

    def['$eql?'] = def['$=='];

    def.$inspect = function() {

      return this.toString();
    };

    def.$match = function(string, pos) {
      var $a;

      var re = this;
      if (re.global) {
        // should we clear it afterwards too?
        re.lastIndex = 0;
      }
      else {
        re = new RegExp(re.source, 'g' + (this.multiline ? 'm' : '') + (this.ignoreCase ? 'i' : ''));
      }

      var result = re.exec(string);

      if (result) {
        return $gvars["~"] = (($a = $scope.MatchData) == null ? $opal.cm("MatchData") : $a).$new(re, result);
      }
      else {
        return $gvars["~"] = $gvars["`"] = $gvars["'"] = nil;
      }
    ;
    };

    def.$source = function() {

      return this.source;
    };

    def.$to_s = def.$source;

    def.$to_n = function() {

      return this.valueOf();
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/regexp.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module;

  $opal.add_stubs(['$==', '$<=>', '$<=', '$>=', '$>', '$<']);
  return (function($base){
    function Comparable() {};
    Comparable = $module($base, "Comparable", Comparable);
    var def = Comparable._proto, $scope = Comparable._scope;

    def['$<'] = function(other) {

      return this['$<=>'](other)['$=='](-1);
    };

    def['$<='] = function(other) {

      return this['$<=>'](other)['$<='](0);
    };

    def['$=='] = function(other) {

      return this['$<=>'](other)['$=='](0);
    };

    def['$>'] = function(other) {

      return this['$<=>'](other)['$=='](1);
    };

    def['$>='] = function(other) {

      return this['$<=>'](other)['$>='](0);
    };

    def['$between?'] = function(min, max) {
      var $a;
      return (($a = this['$>'](min)) ? this['$<'](max) : $a);
    };
    ;$opal.donate(Comparable, ["$<", "$<=", "$==", "$>", "$>=", "$between?"]);
  })(self)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/comparable.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module;

  $opal.add_stubs(['$enum_for', '$==', '$call', '$===', '$[]=', '$new', '$<<', '$[]', '$each', '$>', '$raise', '$<', '$map', '$sort']);
  return (function($base){
    function Enumerable() {};
    Enumerable = $module($base, "Enumerable", Enumerable);
    var def = Enumerable._proto, $scope = Enumerable._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12, TMP_13, TMP_14, TMP_17, TMP_18, TMP_19, TMP_20;

    def['$all?'] = TMP_1 = function() {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;

      var result = true, proc;

      if (block !== nil) {
        proc = function(obj) {
          var value;
          var args = $slice.call(arguments);

          if ((value = block.apply(this, args)) === $breaker) {
            return $breaker.$v;
          }

          if (value === false || value === nil) {
            result = false;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }
      else {
        proc = function(obj) {
          if ((obj === false || obj === nil) && arguments.length < 2) {
            result       = false;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def['$any?'] = TMP_2 = function() {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;

      var result = false, proc;

      if (block !== nil) {
        proc = function(obj) {
          var value;
          var args = $slice.call(arguments);

          if ((value = block.apply(this, args)) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            result       = true;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }
      else {
        proc = function(obj) {
          if ((obj !== false && obj !== nil) || arguments.length >= 2) {
            result      = true;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$collect = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      if (block === nil) {
        return this.$enum_for("collect")
      };

      var result = [];

      var proc = function() {
        var value, args = $slice.call(arguments);

        if ((value = block.apply(null, arguments)) === $breaker) {
          return $breaker.$v;
        }

        result.push(value);
      };

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$reduce = TMP_4 = function(object) {
      var $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;

      var result = object == undefined ? 0 : object;

      var proc = function() {
        var obj = $slice.call(arguments), value;

        if ((value = block.apply(nil, [result].concat(obj))) === $breaker) {
          result = $breaker.$v;
          $breaker.$v = nil;

          return $breaker;
        }

        result = value;
      };

      this.$each._p = proc;
      this.$each();

      return result;
    ;
    };

    def.$count = TMP_5 = function(object) {
      var $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;

      var result = 0;

      if (object != null) {
        block = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          return (param)['$=='](object);
        };
      }
      else if (block === nil) {
        block = function() { return true; };
      }

      var proc = function() {
        var value, param = $slice.call(arguments);

        if ((value = block.apply(null, param)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          result++;
        }
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$detect = TMP_6 = function(ifnone) {
      var $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;

      var result = nil;

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          result       = param;
          $breaker.$v = nil;

          return $breaker;
        }
      };

      this.$each();

      if (result !== nil) {
        return result;
      }

      if (typeof(ifnone) === 'function') {
        return ifnone.$call();
      }

      return ifnone == null ? nil : ifnone;

    };

    def.$drop = function(number) {


      var result  = [],
          current = 0;

      this.$each._p = function() {
        if (number < current) {
          result.push(e);
        }

        current++;
      };

      this.$each()

      return result;

    };

    def.$drop_while = TMP_7 = function() {
      var $iter = TMP_7._p, block = $iter || nil;TMP_7._p = null;

      var result = [];

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param)) === $breaker) {
          return $breaker;
        }

        if (value === false || value === nil) {
          result.push(param);
          return value;
        }

        return $breaker;
      };

      this.$each();

      return result;

    };

    def.$each_slice = TMP_8 = function(n) {
      var $iter = TMP_8._p, block = $iter || nil;TMP_8._p = null;

      var all = [];

      this.$each._p = function() {
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        all.push(param);

        if (all.length == n) {
          block(all.slice(0));
          all = [];
        }
      };

      this.$each();

      // our "last" group, if smaller than n then wont have been yielded
      if (all.length > 0) {
        block(all.slice(0));
      }

      return nil;

    };

    def.$each_with_index = TMP_9 = function() {
      var $iter = TMP_9._p, block = $iter || nil;TMP_9._p = null;

      var index = 0;

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param, index)) === $breaker) {
          return $breaker.$v;
        }

        index++;
      };
      this.$each();

      return nil;

    };

    def.$each_with_object = TMP_10 = function(object) {
      var $iter = TMP_10._p, block = $iter || nil;TMP_10._p = null;

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param, object)) === $breaker) {
          return $breaker.$v;
        }
      };

      this.$each();

      return object;
    ;
    };

    def.$entries = function() {


      var result = [];

      this.$each._p = function() {
        if (arguments.length == 1) {
          result.push(arguments[0]);
        }
        else {
          result.push($slice.call(arguments));
        }
      };

      this.$each();

      return result;

    };

    def.$find = def.$detect;

    def.$find_all = TMP_11 = function() {
      var $iter = TMP_11._p, block = $iter || nil;TMP_11._p = null;

      var result = [];

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          result.push(param);
        }
      };

      this.$each();

      return result;

    };

    def.$find_index = TMP_12 = function(object) {
      var $iter = TMP_12._p, block = $iter || nil;TMP_12._p = null;

      var proc, result = nil, index = 0;

      if (object != null) {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          if ((param)['$=='](object)) {
            result = index;
            return $breaker;
          }

          index += 1;
        };
      }
      else {
        proc = function() {
          var value;
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          if ((value = block(param)) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            result       = index;
            $breaker.$v = index;

            return $breaker;
          }

          index += 1;
        };
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$first = function(number) {


      var result  = [],
          current = 0,
          proc;

      if (number == null) {
        result = nil;
        proc   = function() {
          result = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          return $breaker;
        };
      }
      else {
        proc = function() {
          if (number <= current) {
            return $breaker;
          }

          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          result.push(param);

          current++;
        };
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$grep = TMP_13 = function(pattern) {
      var $iter = TMP_13._p, block = $iter || nil;TMP_13._p = null;

      var result = [],
          proc;

      if (block !== nil) {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          var value = pattern['$==='](param);

          if (value !== false && value !== nil) {
            if ((value = block(param)) === $breaker) {
              return $breaker.$v;
            }

            result.push(value);
          }
        };
      }
      else {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          var value = pattern['$==='](param);

          if (value !== false && value !== nil) {
            result.push(param);
          }
        };
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$group_by = TMP_14 = function() {
      var TMP_15, $a, $b, $c, TMP_16, $iter = TMP_14._p, block = $iter || nil, hash = nil;TMP_14._p = null;
      hash = ($a = ($b = (($c = $scope.Hash) == null ? $opal.cm("Hash") : $c)).$new, $a._p = (TMP_15 = function(h, k) {

        var self = TMP_15._s || this;
        if (h == null) h = nil;
if (k == null) k = nil;

        return h['$[]='](k, [])
      }, TMP_15._s = this, TMP_15), $a).call($b);
      ($a = ($c = this).$each, $a._p = (TMP_16 = function(el) {

        var self = TMP_16._s || this;
        if (el == null) el = nil;

        return hash['$[]'](block.$call(el))['$<<'](el)
      }, TMP_16._s = this, TMP_16), $a).call($c);
      return hash;
    };

    def.$map = def.$collect;

    def.$max = TMP_17 = function() {
      var $a, $iter = TMP_17._p, block = $iter || nil;TMP_17._p = null;

      var proc, result;
      var arg_error = false;

      if (block !== nil) {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          if (result == undefined) {
            result = param;
          }
          else if ((value = block(param, result)) === $breaker) {
            result = $breaker.$v;

            return $breaker;
          }
          else {
            if (value > 0) {
              result = param;
            }

            $breaker.$v = nil;
          }
        }
      }
      else {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          var modules = param.$class().$included_modules;

          if (modules == undefined || modules.length == 0 || modules.indexOf(Opal.Comparable) == -1) {
            arg_error = true;

            return $breaker;
          }

          if (result == undefined || (param)['$>'](result)) {
            result = param;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      if (arg_error) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "Array#max");
      }

      return (result == undefined ? nil : result);

    };

    def.$min = TMP_18 = function() {
      var $a, $iter = TMP_18._p, block = $iter || nil;TMP_18._p = null;

      var proc,
          result,
          arg_error = false;

      if (block !== nil) {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          if (result == undefined) {
            result = param;
          }
          else if ((value = block(param, result)) === $breaker) {
            result = $breaker.$v;

            return $breaker;
          }
          else {
            if (value < 0) {
              result = param;
            }

            $breaker.$v = nil;
          }
        }
      }
      else {
        proc = function(obj) {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          var modules = param.$class().$included_modules;

          if (modules == undefined || modules.length == 0 || modules.indexOf(Opal.Comparable) == -1) {
            arg_error = true;

            return $breaker;
          }

          if (result == undefined || (param)['$<'](result)) {
            result = param;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      if (arg_error) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "Array#min");
      }

      return result == undefined ? nil : result;

    };

    def['$none?'] = TMP_19 = function() {
      var $iter = TMP_19._p, block = $iter || nil;TMP_19._p = null;

      var result = true,
          proc;

      if (block !== nil) {
        proc = function(obj) {
          var value,
              args = $slice.call(arguments);

          if ((value = block.apply(this, args)) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            result       = false;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }
      else {
        proc = function(obj) {
          if (arguments.length == 1 && (obj !== false && obj !== nil)) {
            result       = false;
            $breaker.$v = nil;

            return $breaker;
          }
          else {
            for (var i = 0, length = arguments.length; i < length; i++) {
              if (arguments[i] !== false && arguments[i] !== nil) {
                result       = false;
                $breaker.$v = nil;

                return $breaker;
              }
            }
          }
        };
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$sort_by = TMP_20 = function() {
      var TMP_21, $a, $b, TMP_22, $c, $d, $iter = TMP_20._p, block = $iter || nil;TMP_20._p = null;
      return ($a = ($b = ($c = ($d = this).$map, $c._p = (TMP_22 = function(f) {

        var self = TMP_22._s || this;
        f = $slice.call(arguments, 0);
        f = f.length === 1 ? f[0] : f;
        return [block.$call(f), f];
      }, TMP_22._s = this, TMP_22), $c).call($d).$sort()).$map, $a._p = (TMP_21 = function(f) {

        var self = TMP_21._s || this;
        if (f == null) f = nil;

        return f[1];
      }, TMP_21._s = this, TMP_21), $a).call($b);
    };

    def.$select = def.$find_all;

    def.$take = def.$first;

    def.$to_a = def.$entries;

    def.$inject = def.$reduce;
    ;$opal.donate(Enumerable, ["$all?", "$any?", "$collect", "$reduce", "$count", "$detect", "$drop", "$drop_while", "$each_slice", "$each_with_index", "$each_with_object", "$entries", "$find", "$find_all", "$find_index", "$first", "$grep", "$group_by", "$map", "$max", "$min", "$none?", "$sort_by", "$select", "$take", "$to_a", "$inject"]);
  })(self)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/enumerable.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$enum_for', '$call', '$__send__', '$to_a', '$empty?', '$raise', '$shift']);
  return (function($base, $super){
    function Enumerator() {};
    Enumerator = $klass($base, $super, "Enumerator", Enumerator);

    var def = Enumerator._proto, $scope = Enumerator._scope, $a, TMP_1;
    def.object = def.method = def.args = def.cache = nil;

    Enumerator.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));

    def.$initialize = function(obj, method, args) {
      if (method == null) {
        method = "each"
      }args = $slice.call(arguments, 2);
      this.object = obj;
      this.method = method;
      return this.args = args;
    };

    def.$each = TMP_1 = function() {
      var TMP_2, $a, $b, $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;
      if (block === nil) {
        return this.$enum_for("each")
      };
      return ($a = ($b = this.object).$__send__, $a._p = (TMP_2 = function(e) {

        var self = TMP_2._s || this, $a;
        e = $slice.call(arguments, 0);
        return ($a = block).$call.apply($a, [].concat(e))
      }, TMP_2._s = this, TMP_2), $a).apply($b, [this.method].concat(this.args));
    };

    def.$next = function() {
      var $a;
      ((($a = this.cache) !== false && $a !== nil) ? $a : this.cache = this.$to_a());
      if (($a = this.cache['$empty?']()) !== false && $a !== nil) {
        this.$raise((($a = $scope.StopIteration) == null ? $opal.cm("StopIteration") : $a), "end of enumeration")
      };
      return this.cache.$shift();
    };

    def.$rewind = function() {

      this.cache = nil;
      return this;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/enumerator.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$new', '$class', '$raise', '$respond_to?', '$hash', '$<=>', '$==', '$enum_for', '$flatten', '$replace', '$object_id', '$[]', '$inspect', '$to_s', '$delete_if', '$to_proc', '$each', '$reverse', '$keep_if', '$to_n']);
  return (function($base, $super){
    function Array() {};
    Array = $klass($base, $super, "Array", Array);

    var def = Array._proto, $scope = Array._scope, $a, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12, TMP_13, TMP_14, TMP_15, TMP_16, TMP_17, TMP_18, TMP_19, TMP_20;

    Array.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));

    def._isArray = true;

    Array.constructor.prototype['$[]'] = function(objects) {
      objects = $slice.call(arguments, 0);
      return objects
    };

    def.$initialize = function(args) {
      var $a;args = $slice.call(arguments, 0);
      return ($a = this.$class()).$new.apply($a, [].concat(args));
    };

    Array.constructor.prototype['$new'] = TMP_1 = function(size, obj) {
      var $a, $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;if (obj == null) {
        obj = nil
      }


      if (arguments.length > 2)
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a).$new("wrong number of arguments. Array#new"));

      if (arguments.length == 0)
        return [];

      var size,
          obj = arguments[1],
          arr = [];

      if (!obj) {
        if (size['$respond_to?']("to_ary")) {
          if (size['$is_a?'](Array))
            return size;
          return size['$to_ary']();
        }
      }

      if (typeof(arguments[0]) == 'number')
        size = arguments[0];
      else {
        if ((arguments[0])['$respond_to?']("to_int")) {
          size = arguments[0]['$to_int']();
          if (typeof(size) == 'number') {
            if (size % 1 !== 0) {
              this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Integer. Array#new"));
            }
          } else {
            this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Integer. Array#new"));
          }
        } else {
          this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Integer. Array#new"));
        }
      }

      if (size < 0) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a).$new("negative array size"));
      }

      if (obj == undefined) {
        obj = nil;
      }


      if (block === nil)
        for (var i = 0; i < size; i++) {
          arr.push(obj);
        }
      else {
        for (var i = 0, value; i < size; i++) {
          value = block(i);
          if (value === $breaker) {
            return $breaker.$v;
          }
          arr[i] = block(i);
        }
      }

      return arr;
    ;
    };

    Array.constructor.prototype['$try_convert'] = function(obj) {


      if (obj._isArray) {
        return obj;
      }

      return nil;

    };

    def['$&'] = function(other) {


      var result = [],
          seen   = {};

      for (var i = 0, length = this.length; i < length; i++) {
        var item = this[i];
        if (item._isString) {
          item = item.toString();
        }

        if (!seen[item]) {
          for (var j = 0, length2 = other.length; j < length2; j++) {
            var item2 = other[j];
            if (item2._isString) {
              item2 = item2.toString();
            }

            if (item === item2 && !seen[item]) {
              seen[item] = true;

              result.push(item);
            }
          }
        }
      }

      return result;

    };

    def['$*'] = function(other) {


      if (typeof(other) === 'string') {
        return this.join(other);
      }

      var result = [];

      for (var i = 0; i < other; i++) {
        result = result.concat(this);
      }

      return result;
    ;
    };

    def['$+'] = function(other) {
      var $a;

      var arr = other;

      if (!other._isArray){
        if (other['$respond_to?']("to_ary")) {
          arr = other['$to_ary']();
        }
        else {
          this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Array. Array#+"));
        }
      }

      return this.concat(arr);

    };

    def['$-'] = function(other) {
      var $a;

      var a = this,
          b = other,
          tmp = [],
          result = [];

     if (typeof(b) == "object" && !(b._isArray))  {
        if (other['$respond_to?']("to_ary")) {
          b = b['$to_ary']();
        } else {
          this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Array. Array#-"));
        }
      }else if ((typeof(b) != "object")) {
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Array. Array#-"));
      }

      if (a.length == 0)
        return [];
      if (b.length == 0)
        return a;

      for(var i = 0, length = b.length; i < length; i++) {
        tmp[b[i]] = true;
      }
      for(var i = 0, length = a.length; i < length; i++) {
        if (!tmp[a[i]]) {
          result.push(a[i]);
        }
     }

      return result;
    ;
    };

    def['$<<'] = function(object) {

      this.push(object);;
      return this;
    };

    def['$<=>'] = function(other) {


      if (this.$hash() === other.$hash()) {
        return 0;
      }

      if (this.length != other.length) {
        return (this.length > other.length) ? 1 : -1;
      }

      for (var i = 0, length = this.length, tmp; i < length; i++) {
        if ((tmp = (this[i])['$<=>'](other[i])) !== 0) {
          return tmp;
        }
      }

      return 0;
    ;
    };

    def['$=='] = function(other) {


      if (!other || (this.length !== other.length)) {
        return false;
      }

      for (var i = 0, length = this.length, tmp1, tmp2; i < length; i++) {
        tmp1 = this[i];
        tmp2 = other[i];

        if (tmp1._isArray && tmp2._isArray && (tmp1 === this)) {
          continue;
        }

        if (!((tmp1)['$=='](tmp2))) {
          return false;
        }

      }


      return true;
    ;
    };

    def['$[]'] = function(index, length) {


      var size = this.length;

      if (typeof index !== 'number' && !index._isNumber) {
        if (index._isRange) {
          var exclude = index.exclude;
          length      = index.end;
          index       = index.begin;

          if (index > size) {
            return nil;
          }

          if (length < 0) {
            length += size;
          }

          if (!exclude) length += 1;
          return this.slice(index, length);
        }
        else {
          this.$raise("bad arg for Array#[]");
        }
      }

      if (index < 0) {
        index += size;
      }

      if (length !== undefined) {
        if (length < 0 || index > size || index < 0) {
          return nil;
        }

        return this.slice(index, index + length);
      }
      else {
        if (index >= size || index < 0) {
          return nil;
        }

        return this[index];
      }
    ;
    };

    def['$[]='] = function(index, value) {


      var size = this.length;

      if (index < 0) {
        index += size;
      }

      return this[index] = value;
    ;
    };

    def.$assoc = function(object) {


      for (var i = 0, length = this.length, item; i < length; i++) {
        if (item = this[i], item.length && (item[0])['$=='](object)) {
          return item;
        }
      }

      return nil;
    ;
    };

    def.$at = function(index) {


      if (index < 0) {
        index += this.length;
      }

      if (index < 0 || index >= this.length) {
        return nil;
      }

      return this[index];
    ;
    };

    def.$clear = function() {

      this.splice(0, this.length);
      return this;
    };

    def.$clone = function() {

      return this.slice();
    };

    def.$collect = TMP_2 = function() {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;

      var result = [];


      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        result.push(value);
      }

      return result;

    };

    def['$collect!'] = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;

      for (var i = 0, length = this.length, val; i < length; i++) {
        if ((val = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        this[i] = val;
      }
    ;
      return this;
    };

    def.$compact = function() {


      var result = [];

      for (var i = 0, length = this.length, item; i < length; i++) {
        if ((item = this[i]) !== nil) {
          result.push(item);
        }
      }

      return result;

    };

    def['$compact!'] = function() {


      var original = this.length;

      for (var i = 0, length = this.length; i < length; i++) {
        if (this[i] === nil) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this.length === original ? nil : this;
    ;
    };

    def.$concat = function(other) {


      for (var i = 0, length = other.length; i < length; i++) {
        this.push(other[i]);
      }

      return this;
    };

    def.$count = function(object) {


      if (object == null) {
        return this.length;
      }

      var result = 0;

      for (var i = 0, length = this.length; i < length; i++) {
        if ((this[i])['$=='](object)) {
          result++;
        }
      }

      return result;
    ;
    };

    def.$delete = function(object) {


      var original = this.length;

      for (var i = 0, length = original; i < length; i++) {
        if ((this[i])['$=='](object)) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this.length === original ? nil : object;
    ;
    };

    def.$delete_at = function(index) {


      if (index < 0) {
        index += this.length;
      }

      if (index < 0 || index >= this.length) {
        return nil;
      }

      var result = this[index];

      this.splice(index, 1);

      return result;
    ;
    };

    def.$delete_if = TMP_4 = function() {
      var $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;

      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }
    ;
      return this;
    };

    def.$drop = function(number) {

      return this.slice(number);
    };

    def.$dup = def.$clone;

    def.$each = TMP_5 = function() {
      var $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;
      if (block === nil) {
        return this.$enum_for("each")
      };

      if (block.length > 1) {
        for (var i = 0, length = this.length, el; i < length; i++) {
          el = this[i];
          if (!el._isArray) el = [el];

          if (block.apply(null, el) === $breaker) return $breaker.$v;
        }
      } else {
        for (var i = 0, length = this.length; i < length; i++) {
          if (block(this[i]) === $breaker) return $breaker.$v;
        }
      }
    ;
      return this;
    };

    def.$each_index = TMP_6 = function() {
      var $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;
      for (var i = 0, length = this.length; i < length; i++) {;
      if ($opal.$yield1(block, i) === $breaker) return $breaker.$v;
      };
      return this;
    };

    def['$empty?'] = function() {

      return !this.length;
    };

    def.$fetch = TMP_7 = function(index, defaults) {
      var $a, $iter = TMP_7._p, block = $iter || nil;TMP_7._p = null;

      var original = index;

      if (index < 0) {
        index += this.length;
      }

      if (index >= 0 && index < this.length) {
        return this[index];
      }

      if (defaults != null) {
        return defaults;
      }

      if (block !== nil) {
        return block(original);
      }

      this.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a), "Array#fetch");
    ;
    };

    def.$fill = TMP_8 = function(obj) {
      var $iter = TMP_8._p, block = $iter || nil;TMP_8._p = null;

      if (block !== nil) {
        for (var i = 0, length = this.length; i < length; i++) {
          this[i] = block(i);
        }
      }
      else {
        for (var i = 0, length = this.length; i < length; i++) {
          this[i] = obj;
        }
      }
    ;
      return this;
    };

    def.$first = function(count) {


      if (count != null) {
        return this.slice(0, count);
      }

      return this.length === 0 ? nil : this[0];
    ;
    };

    def.$flatten = function(level) {


      var result = [];

      for (var i = 0, length = this.length, item; i < length; i++) {
        item = this[i];

        if (item._isArray) {
          if (level == null) {
            result = result.concat((item).$flatten());
          }
          else if (level === 0) {
            result.push(item);
          }
          else {
            result = result.concat((item).$flatten(level - 1));
          }
        }
        else {
          result.push(item);
        }
      }

      return result;

    };

    def['$flatten!'] = function(level) {


      var size = this.length;
      this.$replace(this.$flatten(level));

      return size === this.length ? nil : this;
    ;
    };

    def.$hash = function() {

      return this._id || (this._id = Opal.uid());
    };

    def['$include?'] = function(member) {


      for (var i = 0, length = this.length; i < length; i++) {
        if ((this[i])['$=='](member)) {
          return true;
        }
      }

      return false;
    ;
    };

    def.$index = TMP_9 = function(object) {
      var $iter = TMP_9._p, block = $iter || nil;TMP_9._p = null;

      if (object != null) {
        for (var i = 0, length = this.length; i < length; i++) {
          if ((this[i])['$=='](object)) {
            return i;
          }
        }
      }
      else if (block !== nil) {
        for (var i = 0, length = this.length, value; i < length; i++) {
          if ((value = block(this[i])) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            return i;
          }
        }
      }

      return nil;
    ;
    };

    def.$insert = function(index, objects) {
      var $a;objects = $slice.call(arguments, 1);

      if (objects.length > 0) {
        if (index < 0) {
          index += this.length + 1;

          if (index < 0) {
            this.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a), "" + (index) + " is out of bounds");
          }
        }
        if (index > this.length) {
          for (var i = this.length; i < index; i++) {
            this.push(nil);
          }
        }

        this.splice.apply(this, [index, 0].concat(objects));
      }
    ;
      return this;
    };

    def.$inspect = function() {


      var i, inspect, el, el_insp, length, object_id;

      inspect = [];
      object_id = this.$object_id();
      length = this.length;

      for (i = 0; i < length; i++) {
        el = this['$[]'](i);

        // Check object_id to ensure it's not the same array get into an infinite loop
        el_insp = (el).$object_id() === object_id ? '[...]' : (el).$inspect();

        inspect.push(el_insp);
      }
      return '[' + inspect.join(', ') + ']';
    ;
    };

    def.$join = function(sep) {
      if (sep == null) {
        sep = ""
      }

      var result = [];

      for (var i = 0, length = this.length; i < length; i++) {
        result.push((this[i]).$to_s());
      }

      return result.join(sep);

    };

    def.$keep_if = TMP_10 = function() {
      var $iter = TMP_10._p, block = $iter || nil;TMP_10._p = null;

      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }
    ;
      return this;
    };

    def.$last = function(count) {
      var $a;

      var length = this.length;

      if (count === nil || typeof(count) == 'string') {
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "no implicit conversion to integer");
      }

      if (typeof(count) == 'object') {
        if (count['$respond_to?']("to_int")) {
          count = count['$to_int']();
        }
        else {
          this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "no implicit conversion to integer");
        }
      }

      if (count == null) {
        return length === 0 ? nil : this[length - 1];
      }
      else if (count < 0) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "negative count given");
      }

      if (count > length) {
        count = length;
      }

      return this.slice(length - count, length);
    ;
    };

    def.$length = function() {

      return this.length;
    };

    def.$map = def.$collect;

    def['$map!'] = def['$collect!'];

    def.$pop = function(count) {


      var length = this.length;

      if (count == null) {
        return length === 0 ? nil : this.pop();
      }

      if (count < 0) {
        this.$raise("negative count given");
      }

      return count > length ? this.splice(0, this.length) : this.splice(length - count, length);
    ;
    };

    def.$push = function(objects) {
      objects = $slice.call(arguments, 0);

      for (var i = 0, length = objects.length; i < length; i++) {
        this.push(objects[i]);
      }

      return this;
    };

    def.$rassoc = function(object) {


      for (var i = 0, length = this.length, item; i < length; i++) {
        item = this[i];

        if (item.length && item[1] !== undefined) {
          if ((item[1])['$=='](object)) {
            return item;
          }
        }
      }

      return nil;
    ;
    };

    def.$reject = TMP_11 = function() {
      var $iter = TMP_11._p, block = $iter || nil;TMP_11._p = null;

      var result = [];

      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          result.push(this[i]);
        }
      }
      return result;

    };

    def['$reject!'] = TMP_12 = function() {
      var $a, $b, $iter = TMP_12._p, block = $iter || nil;TMP_12._p = null;

      var original = this.length;
      ($a = ($b = this).$delete_if, $a._p = block.$to_proc(), $a).call($b);
      return this.length === original ? nil : this;
    ;
    };

    def.$replace = function(other) {


      this.splice(0, this.length);
      this.push.apply(this, other);
      return this;
    ;
    };

    def.$reverse = function() {

      return this.slice(0).reverse();
    };

    def['$reverse!'] = function() {

      return this.reverse();
    };

    def.$reverse_each = TMP_13 = function() {
      var $a, $b, $iter = TMP_13._p, block = $iter || nil;TMP_13._p = null;
      ($a = ($b = this.$reverse()).$each, $a._p = block.$to_proc(), $a).call($b);
      return this;
    };

    def.$rindex = TMP_14 = function(object) {
      var $iter = TMP_14._p, block = $iter || nil;TMP_14._p = null;

      if (block !== nil) {
        for (var i = this.length - 1, value; i >= 0; i--) {
          if ((value = block(this[i])) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            return i;
          }
        }
      }
      else {
        for (var i = this.length - 1; i >= 0; i--) {
          if ((this[i])['$=='](object)) {
            return i;
          }
        }
      }

      return nil;
    ;
    };

    def.$select = TMP_15 = function() {
      var $iter = TMP_15._p, block = $iter || nil;TMP_15._p = null;

      var result = [];

      for (var i = 0, length = this.length, item, value; i < length; i++) {
        item = this[i];

        if ((value = block(item)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          result.push(item);
        }
      }

      return result;

    };

    def['$select!'] = TMP_16 = function() {
      var $a, $b, $iter = TMP_16._p, block = $iter || nil;TMP_16._p = null;

      var original = this.length;
      ($a = ($b = this).$keep_if, $a._p = block.$to_proc(), $a).call($b);
      return this.length === original ? nil : this;
    ;
    };

    def.$shift = function(count) {


      if (this.length === 0) {
        return nil;
      }

      return count == null ? this.shift() : this.splice(0, count)
    ;
    };

    def.$size = def.$length;

    def.$shuffle = function() {


        for (var i = this.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = this[i];
          this[i] = this[j];
          this[j] = tmp;
        }

        return this;
    ;
    };

    def.$slice = def['$[]'];

    def['$slice!'] = function(index, length) {


      if (index < 0) {
        index += this.length;
      }

      if (length != null) {
        return this.splice(index, length);
      }

      if (index < 0 || index >= this.length) {
        return nil;
      }

      return this.splice(index, 1)[0];
    ;
    };

    def.$sort = TMP_17 = function() {
      var $a, $iter = TMP_17._p, block = $iter || nil;TMP_17._p = null;

      var copy = this.slice();
      var t_arg_error = false;
      var t_break = [];

      if (block !== nil) {
        var result = copy.sort(function(x, y) {
          var result = block(x, y);
          if (result === $breaker) {
            t_break.push($breaker.$v);
          }
          if (result === nil) {
            t_arg_error = true;
          }
          if ((result != null) && (result)['$respond_to?']("<=>")) {
            result = result['$<=>'](0);
          }
          if (result !== -1 && result !== 0 && result !== 1) {
            t_arg_error = true;
          }
          return result;
        });

        if (t_break.length > 0)
          return t_break[0];
        if (t_arg_error)
          this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "Array#sort");

        return result;
      }

      var result = copy.sort(function(a, b){
        if (typeof(a) !== typeof(b)) {
          t_arg_error = true;
        }

        if (a['$<=>'] && typeof(a['$<=>']) == "function") {
          var result = a['$<=>'](b);
          if (result === nil) {
            t_arg_error = true;
          }
          return result;
        }
        if (a > b)
          return 1;
        if (a < b)
          return -1;
        return 0;
      });

      if (t_arg_error)
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "Array#sort");

      return result;
    ;
    };

    def['$sort!'] = TMP_18 = function() {
      var $iter = TMP_18._p, block = $iter || nil;TMP_18._p = null;

      var result;
      if (block !== nil) {
        //strangely
        result = this.slice().sort(block);
      } else {
        result = this.slice()['$sort']();
      }
      this.length = 0;
      for(var i = 0; i < result.length; i++) {
        this.push(result[i]);
      }
      return this;

    };

    def.$take = function(count) {

      return this.slice(0, count);
    };

    def.$take_while = TMP_19 = function() {
      var $iter = TMP_19._p, block = $iter || nil;TMP_19._p = null;

      var result = [];

      for (var i = 0, length = this.length, item, value; i < length; i++) {
        item = this[i];

        if ((value = block(item)) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          return result;
        }

        result.push(item);
      }

      return result;

    };

    def.$to_a = function() {

      return this;
    };

    def.$to_ary = def.$to_a;

    def.$to_n = function() {


      var result = [], obj

      for (var i = 0, len = this.length; i < len; i++) {
        obj = this[i];

        if (obj.$to_n) {
          result.push((obj).$to_n());
        }
        else {
          result.push(obj);
        }
      }

      return result;
    ;
    };

    def.$to_s = def.$inspect;

    def.$uniq = function() {


      var result = [],
          seen   = {};

      for (var i = 0, length = this.length, item, hash; i < length; i++) {
        item = this[i];
        hash = item;

        if (!seen[hash]) {
          seen[hash] = true;

          result.push(item);
        }
      }

      return result;

    };

    def['$uniq!'] = function() {


      var original = this.length,
          seen     = {};

      for (var i = 0, length = original, item, hash; i < length; i++) {
        item = this[i];
        hash = item;

        if (!seen[hash]) {
          seen[hash] = true;
        }
        else {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this.length === original ? nil : this;
    ;
    };

    def.$unshift = function(objects) {
      objects = $slice.call(arguments, 0);

      for (var i = objects.length - 1; i >= 0; i--) {
        this.unshift(objects[i]);
      }

      return this;

    };

    def.$zip = TMP_20 = function(others) {
      var $iter = TMP_20._p, block = $iter || nil;TMP_20._p = null;others = $slice.call(arguments, 0);

      var result = [], size = this.length, part, o;

      for (var i = 0; i < size; i++) {
        part = [this[i]];

        for (var j = 0, jj = others.length; j < jj; j++) {
          o = others[j][i];

          if (o == null) {
            o = nil;
          }

          part[j + 1] = o;
        }

        result[i] = part;
      }

      if (block !== nil) {
        for (var i = 0; i < size; i++) {
          block(result[i]);
        }

        return nil;
      }

      return result;
    ;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/array.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$==', '$call', '$enum_for', '$raise', '$flatten', '$inspect', '$to_n']);
  return (function($base, $super){
    function Hash() {};
    Hash = $klass($base, $super, "Hash", Hash);

    var def = Hash._proto, $scope = Hash._scope, $a, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12;
    def.proc = def.none = nil;

    Hash.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));


    var $hash = Opal.hash = function() {
      if (arguments.length == 1 && arguments[0]._klass == Hash) {
        return arguments[0];
      }

      var hash   = new Hash._alloc,
          args   = $slice.call(arguments),
          keys   = [],
          assocs = {};

      hash.map   = assocs;
      hash.keys  = keys;

      for (var i = 0, length = args.length, key; i < length; i++) {
        var key = args[i], obj = args[++i];

        if (assocs[key] == null) {
          keys.push(key);
        }

        assocs[key] = obj;
      }

      return hash;
    };



    var $hash2 = Opal.hash2 = function(keys, map) {
      var hash = new Hash._alloc;
      hash.keys = keys;
      hash.map = map;
      return hash;
    };


    var $hasOwn = {}.hasOwnProperty;

    Hash.constructor.prototype['$[]'] = function(objs) {
      objs = $slice.call(arguments, 0);
      return $hash.apply(null, objs);
    };

    Hash.constructor.prototype['$allocate'] = function() {


      var hash = new this._alloc;
      hash.map = {};
      hash.keys = [];
      return hash;
    ;
    };

    def.$initialize = TMP_1 = function(defaults) {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;

      if (defaults != null) {
        if (defaults.constructor == Object) {
          var map = this.map, keys = this.keys;

          for (var key in defaults) {
            keys.push(key);
            map[key] = defaults[key];
          }
        }
        else {
          this.none = defaults;
        }
      }
      else if (block !== nil) {
          this.proc = block;
      }

      return this;
    ;
    };

    def['$=='] = function(other) {
      var $a;

      if (this === other) {
        return true;
      }

      if (!other.map || !other.keys) {
        return false;
      }

      if (this.keys.length !== other.keys.length) {
        return false;
      }

      var map  = this.map,
          map2 = other.map;

      for (var i = 0, length = this.keys.length; i < length; i++) {
        var key = this.keys[i], obj = map[key], obj2 = map2[key];

        if (($a = (obj)['$=='](obj2), ($a === nil || $a === false))) {
          return false;
        }
      }

      return true;
    ;
    };

    def['$[]'] = function(key) {


      var bucket = this.map[key];

      if (bucket != null) {
        return bucket;
      }

      var proc = this.proc;

      if (proc !== nil) {
        return (proc).$call(this, key);
      }

      return this.none;
    ;
    };

    def['$[]='] = function(key, value) {


      var map = this.map;

      if (!$hasOwn.call(map, key)) {
        this.keys.push(key);
      }

      map[key] = value;

      return value;
    ;
    };

    def.$assoc = function(object) {


      var keys = this.keys, key;

      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];

        if ((key)['$=='](object)) {
          return [key, this.map[key]];
        }
      }

      return nil;
    ;
    };

    def.$clear = function() {


      this.map = {};
      this.keys = [];
      return this;
    ;
    };

    def.$clone = function() {


      var result = $hash(),
          map    = this.map,
          map2   = result.map,
          keys2  = result.keys;

      for (var i = 0, length = this.keys.length; i < length; i++) {
        keys2.push(this.keys[i]);
        map2[this.keys[i]] = map[this.keys[i]];
      }

      return result;
    ;
    };

    def.$default = function(val) {

      return this.none;
    };

    def['$default='] = function(object) {

      return this.none = object;
    };

    def.$default_proc = function() {

      return this.proc;
    };

    def['$default_proc='] = function(proc) {

      return this.proc = proc;
    };

    def.$delete = function(key) {


      var map  = this.map, result = map[key];

      if (result != null) {
        delete map[key];
        this.keys.$delete(key);

        return result;
      }

      return nil;
    ;
    };

    def.$delete_if = TMP_2 = function() {
      var $a, $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("delete_if")
      };

      var map = this.map, keys = this.keys, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
        }
      }

      return this;
    ;
    };

    def.$dup = def.$clone;

    def.$each = TMP_3 = function() {
      var $a, $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("each")
      };

      var map = this.map, keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if ($opal.$yield1(block, [key, map[key]]) === $breaker) return $breaker.$v;
      }

      return this;
    ;
    };

    def.$each_key = TMP_4 = function() {
      var $a, $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("each_key")
      };

      var keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if (block(key) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;
    ;
    };

    def.$each_pair = def.$each;

    def.$each_value = TMP_5 = function() {
      var $a, $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("each_value")
      };

      var map = this.map, keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        if (block(map[keys[i]]) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;
    ;
    };

    def['$empty?'] = function() {

      return this.keys.length === 0;
    };

    def['$eql?'] = def['$=='];

    def.$fetch = TMP_6 = function(key, defaults) {
      var $a, $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;

      var value = this.map[key];

      if (value != null) {
        return value;
      }

      if (block !== nil) {
        var value;

        if ((value = block(key)) === $breaker) {
          return $breaker.$v;
        }

        return value;
      }

      if (defaults != null) {
        return defaults;
      }

      this.$raise((($a = $scope.KeyError) == null ? $opal.cm("KeyError") : $a), "key not found");
    ;
    };

    def.$flatten = function(level) {


      var map = this.map, keys = this.keys, result = [];

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], value = map[key];

        result.push(key);

        if (value._isArray) {
          if (level == null || level === 1) {
            result.push(value);
          }
          else {
            result = result.concat((value).$flatten(level - 1));
          }
        }
        else {
          result.push(value);
        }
      }

      return result;
    ;
    };

    def['$has_key?'] = function(key) {

      return this.map[key] != null;
    };

    def['$has_value?'] = function(value) {


      for (var assoc in this.map) {
        if ((this.map[assoc])['$=='](value)) {
          return true;
        }
      }

      return false;
    ;
    };

    def.$hash = function() {

      return this._id;
    };

    def['$include?'] = def['$has_key?'];

    def.$index = function(object) {


      var map = this.map, keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if (object['$=='](map[key])) {
          return key;
        }
      }

      return nil;
    ;
    };

    def.$indexes = function(keys) {
      keys = $slice.call(arguments, 0);

      var result = [], map = this.map, val;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], val = map[key];

        if (val != null) {
          result.push(val);
        }
        else {
          result.push(this.none);
        }
      }

      return result;
    ;
    };

    def.$indices = def.$indexes;

    def.$inspect = function() {


      var inspect = [], keys = this.keys, map = this.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], val = map[key];

        if (val === this) {
          inspect.push((key).$inspect() + '=>' + '{...}');
        } else {
          inspect.push((key).$inspect() + '=>' + (map[key]).$inspect());
        }
      }

      return '{' + inspect.join(', ') + '}';
    ;
    };

    def.$invert = function() {


      var result = $hash(), keys = this.keys, map = this.map,
          keys2 = result.keys, map2 = result.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        keys2.push(obj);
        map2[obj] = key;
      }

      return result;
    ;
    };

    def.$keep_if = TMP_7 = function() {
      var $a, $iter = TMP_7._p, block = $iter || nil;TMP_7._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("keep_if")
      };

      var map = this.map, keys = this.keys, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
        }
      }

      return this;
    ;
    };

    def.$key = def.$index;

    def['$key?'] = def['$has_key?'];

    def.$keys = function() {


      return this.keys.slice(0);
    ;
    };

    def.$length = function() {


      return this.keys.length;
    ;
    };

    def['$member?'] = def['$has_key?'];

    def.$merge = TMP_8 = function(other) {
      var $iter = TMP_8._p, block = $iter || nil;TMP_8._p = null;

      var keys = this.keys, map = this.map,
          result = $hash(), keys2 = result.keys, map2 = result.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        keys2.push(key);
        map2[key] = map[key];
      }

      var keys = other.keys, map = other.map;

      if (block === nil) {
        for (var i = 0, length = keys.length; i < length; i++) {
          var key = keys[i];

          if (map2[key] == null) {
            keys2.push(key);
          }

          map2[key] = map[key];
        }
      }
      else {
        for (var i = 0, length = keys.length; i < length; i++) {
          var key = keys[i];

          if (map2[key] == null) {
            keys2.push(key);
            map2[key] = map[key];
          }
          else {
            map2[key] = block(key, map2[key], map[key]);
          }
        }
      }

      return result;
    ;
    };

    def['$merge!'] = TMP_9 = function(other) {
      var $iter = TMP_9._p, block = $iter || nil;TMP_9._p = null;

      var keys = this.keys, map = this.map,
          keys2 = other.keys, map2 = other.map;

      if (block === nil) {
        for (var i = 0, length = keys2.length; i < length; i++) {
          var key = keys2[i];

          if (map[key] == null) {
            keys.push(key);
          }

          map[key] = map2[key];
        }
      }
      else {
        for (var i = 0, length = keys2.length; i < length; i++) {
          var key = keys2[i];

          if (map[key] == null) {
            keys.push(key);
            map[key] = map2[key];
          }
          else {
            map[key] = block(key, map[key], map2[key]);
          }
        }
      }

      return this;
    ;
    };

    def.$rassoc = function(object) {


      var keys = this.keys, map = this.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((obj)['$=='](object)) {
          return [key, obj];
        }
      }

      return nil;
    ;
    };

    def.$reject = TMP_10 = function() {
      var $a, $iter = TMP_10._p, block = $iter || nil;TMP_10._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("reject")
      };

      var keys = this.keys, map = this.map,
          result = $hash(), map2 = result.map, keys2 = result.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key], value;

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          keys2.push(key);
          map2[key] = obj;
        }
      }

      return result;
    ;
    };

    def.$replace = function(other) {


      var map = this.map = {}, keys = this.keys = [];

      for (var i = 0, length = other.keys.length; i < length; i++) {
        var key = other.keys[i];
        keys.push(key);
        map[key] = other.map[key];
      }

      return this;
    ;
    };

    def.$select = TMP_11 = function() {
      var $a, $iter = TMP_11._p, block = $iter || nil;TMP_11._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("select")
      };

      var keys = this.keys, map = this.map,
          result = $hash(), map2 = result.map, keys2 = result.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key], value;

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          keys2.push(key);
          map2[key] = obj;
        }
      }

      return result;
    ;
    };

    def['$select!'] = TMP_12 = function() {
      var $a, $iter = TMP_12._p, block = $iter || nil;TMP_12._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("select!")
      };

      var map = this.map, keys = this.keys, value, result = nil;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
          result = this
        }
      }

      return result;
    ;
    };

    def.$shift = function() {


      var keys = this.keys, map = this.map;

      if (keys.length) {
        var key = keys[0], obj = map[key];

        delete map[key];
        keys.splice(0, 1);

        return [key, obj];
      }

      return nil;
    ;
    };

    def.$size = def.$length;

    def.$to_a = function() {


      var keys = this.keys, map = this.map, result = [];

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];
        result.push([key, map[key]]);
      }

      return result;
    ;
    };

    def.$to_hash = function() {

      return this;
    };

    def.$to_n = function() {


      var result = {}, keys = this.keys, map = this.map, bucket, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if (obj.$to_n) {
          result[key] = (obj).$to_n();
        }
        else {
          result[key] = obj;
        }
      }

      return result;
    ;
    };

    def.$to_s = def.$inspect;

    def.$update = def['$merge!'];

    def['$value?'] = function(value) {


      var map = this.map;

      for (var assoc in map) {
        var v = map[assoc];
        if ((v)['$=='](value)) {
          return true;
        }
      }

      return false;
    ;
    };

    def.$values_at = def.$indexes;

    def.$values = function() {


      var map    = this.map,
          result = [];

      for (var key in map) {
        result.push(map[key]);
      }

      return result;
    ;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/hash.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, $gvars = $opal.gvars;

  $opal.add_stubs(['$include', '$to_str', '$is_a?', '$format', '$raise', '$=~', '$ljust', '$floor', '$/', '$+', '$size', '$rjust', '$ceil', '$each', '$split', '$chomp', '$block_given?', '$escape', '$to_i', '$match', '$to_proc', '$new', '$[]', '$str', '$to_s', '$value', '$try_convert', '$class', '$attr_reader']);
  (function($base, $super){
    function String() {};
    String = $klass($base, $super, "String", String);

    var def = String._proto, $scope = String._scope, $a, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6;

    String.$include((($a = $scope.Comparable) == null ? $opal.cm("Comparable") : $a));

    def._isString = true;

    var native_string = "".constructor;

    String.constructor.prototype['$try_convert'] = function(what) {

      try {
        return what.$to_str()
      } catch ($err) {
      if (true){
        return nil}else { throw $err; }
      }
    };

    String.constructor.prototype['$new'] = function(str) {
      if (str == null) {
        str = ""
      }

      return new native_string(str)
    ;
    };

    def['$%'] = function(data) {
      var $a, $b;
      if (($a = data['$is_a?']((($b = $scope.Array) == null ? $opal.cm("Array") : $b))) !== false && $a !== nil) {
        return ($a = this).$format.apply($a, [this].concat(data))
      } else {
        return this.$format(this, data)
      };
    };

    def['$*'] = function(count) {


      if (count < 1) {
        return '';
      }

      var result  = '',
          pattern = this.valueOf();

      while (count > 0) {
        if (count & 1) {
          result += pattern;
        }

        count >>= 1, pattern += pattern;
      }

      return result;

    };

    def['$+'] = function(other) {

      return this.toString() + other;
    };

    def['$<=>'] = function(other) {


      if (typeof other !== 'string') {
        return nil;
      }

      return this > other ? 1 : (this < other ? -1 : 0);
    ;
    };

    def['$<'] = function(other) {

      return this < other;
    };

    def['$<='] = function(other) {

      return this <= other;
    };

    def['$>'] = function(other) {

      return this > other;
    };

    def['$>='] = function(other) {

      return this >= other;
    };

    def['$=='] = function(other) {

      return other == native_string(this);
    };

    def['$==='] = def['$=='];

    def['$=~'] = function(other) {


      if (typeof other === 'string') {
        this.$raise("string given");
      }

      return other['$=~'](this);
    ;
    };

    def['$[]'] = function(index, length) {


      var size = this.length;

      if (index._isRange) {
        var exclude = index.exclude,
            length  = index.end,
            index   = index.begin;

        if (index < 0) {
          index += size;
        }

        if (length < 0) {
          length += size;
        }

        if (!exclude) {
          length += 1;
        }

        if (index > size) {
          return nil;
        }

        length = length - index;

        if (length < 0) {
          length = 0;
        }

        return this.substr(index, length);
      }

      if (index < 0) {
        index += this.length;
      }

      if (length == null) {
        if (index >= this.length || index < 0) {
          return nil;
        }

        return this.substr(index, 1);
      }

      if (index > this.length || index < 0) {
        return nil;
      }

      return this.substr(index, length);
    ;
    };

    def.$capitalize = function() {

      return this.charAt(0).toUpperCase() + this.substr(1).toLowerCase();
    };

    def.$casecmp = function(other) {


      if (typeof other !== 'string') {
        return other;
      }

      var a = this.toLowerCase(),
          b = other.toLowerCase();

      return a > b ? 1 : (a < b ? -1 : 0);

    };

    def.$center = function(width, padstr) {
      if (padstr == null) {
        padstr = " "
      }

      if (width <= this.length) {
        return this;
      }
      else {
        var ljustified = this.$ljust(width['$+'](this.$size())['$/'](2).$floor(), padstr);
        var rjustified = this.$rjust(width['$+'](this.$size())['$/'](2).$ceil(), padstr);
        return ljustified + rjustified.slice(this.length);
      }
    ;
    };

    def.$chars = TMP_1 = function() {
      var $iter = TMP_1._p, $yield = $iter || nil;TMP_1._p = null;

      for (var i = 0, length = this.length; i < length; i++) {
        if ($opal.$yield1($yield, this.charAt(i)) === $breaker) return $breaker.$v
      }
    ;
    };

    def.$chomp = function(separator) {
      if (separator == null) {
        separator = $gvars["/"]
      }

      var strlen = this.length;
      var seplen = separator.length;
      if (strlen > 0) {
        if (separator === "\n") {
          var last = this.charAt(strlen - 1);
          if (last === "\n" || last == "\r") {
            var result = this.substr(0, strlen - 1);
            if (strlen > 1 && this.charAt(strlen - 2) === "\r") {
              result = this.substr(0, strlen - 2);
            }
            return result;
          }
        }
        else if (separator === "") {
          return this.replace(/(?:\n|\r\n)+$/, '');
        }
        else if (strlen >= seplen) {
          var tail = this.substr(-1 * seplen);
          if (tail === separator) {
            return this.substr(0, strlen - seplen);
          }
        }
      }
      return this
    ;
    };

    def.$chop = function() {

      return this.substr(0, this.length - 1);
    };

    def.$chr = function() {

      return this.charAt(0);
    };

    def.$clone = function() {

      return this.slice();
    };

    def.$count = function(str) {

      return (this.length - this.replace(new RegExp(str,"g"), '').length) / str.length;
    };

    def.$dup = def.$clone;

    def.$downcase = function() {

      return this.toLowerCase();
    };

    def.$each_char = def.$chars;

    def.$each_line = TMP_2 = function(separator) {
      var $iter = TMP_2._p, $yield = $iter || nil;TMP_2._p = null;if (separator == null) {
        separator = $gvars["/"]
      }
      if ($yield === nil) {
        return this.$split(separator).$each()
      };

      var chomped = this.$chomp();
      var trailing_separator = this.length != chomped.length
      var splitted = chomped.split(separator);

      if (!($yield !== nil)) {
        result = []
        for (var i = 0, length = splitted.length; i < length; i++) {
          if (i < length - 1 || trailing_separator) {
            result.push(splitted[i] + separator);
          }
          else {
            result.push(splitted[i]);
          }
        }

        return (result).$each();
      }

      for (var i = 0, length = splitted.length; i < length; i++) {
        if (i < length - 1 || trailing_separator) {
          if ($opal.$yield1($yield, splitted[i] + separator) === $breaker) return $breaker.$v
        }
        else {
          if ($opal.$yield1($yield, splitted[i]) === $breaker) return $breaker.$v
        }
      }
    ;
    };

    def['$empty?'] = function() {

      return this.length === 0;
    };

    def['$end_with?'] = function(suffixes) {
      suffixes = $slice.call(arguments, 0);

      for (var i = 0, length = suffixes.length; i < length; i++) {
        var suffix = suffixes[i];

        if (this.length >= suffix.length && this.substr(0 - suffix.length) === suffix) {
          return true;
        }
      }

      return false;
    ;
    };

    def['$eql?'] = def['$=='];

    def['$equal?'] = function(val) {

      return this.toString() === val.toString();
    };

    def.$getbyte = function(idx) {

      return this.charCodeAt(idx);
    };

    def.$gsub = TMP_3 = function(pattern, replace) {
      var $a, $b, $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      if (($a = pattern['$is_a?']((($b = $scope.String) == null ? $opal.cm("String") : $b))) !== false && $a !== nil) {
        pattern = (new RegExp("" + (($a = $scope.Regexp) == null ? $opal.cm("Regexp") : $a).$escape(pattern)))
      };

      var pattern = pattern.toString(),
          options = pattern.substr(pattern.lastIndexOf('/') + 1) + 'g',
          regexp  = pattern.substr(1, pattern.lastIndexOf('/') - 1);

      this.$sub._p = block;
      return this.$sub(new RegExp(regexp, options), replace);

    };

    def.$hash = function() {

      return this.toString();
    };

    def.$hex = function() {

      return this.$to_i(16);
    };

    def['$include?'] = function(other) {

      return this.indexOf(other) !== -1;
    };

    def.$index = function(what, offset) {
      var $a;if (offset == null) {
        offset = nil
      }

      if ( !(what != null && (what._isString || what._isRegexp)) ) {
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "type mismatch");
      }

      var result = -1;

      if (offset != null) {
        if (offset < 0) {
          offset = offset + this.length;
        }

        if (offset > this.length) {
          return nil;
        }

        if (what['$is_a?']((($a = $scope.Regexp) == null ? $opal.cm("Regexp") : $a))) {
          result = ((($a = what['$=~'](this.substr(offset))) !== false && $a !== nil) ? $a : -1)
        } else {
          result = this.substr(offset).indexOf(what);
        }

        if (result !== -1) {
          result += offset;
        }
      } else {
        if (what['$is_a?']((($a = $scope.Regexp) == null ? $opal.cm("Regexp") : $a))) {
          result = ((($a = what['$=~'](this)) !== false && $a !== nil) ? $a : -1)
        } else {
          result = this.indexOf(what);
        }
      }

      return result === -1 ? nil : result;
    ;
    };

    def.$inspect = function() {


      var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
          meta      = {
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
          };

      escapable.lastIndex = 0;

      return escapable.test(this) ? '"' + this.replace(escapable, function(a) {
        var c = meta[a];

        return typeof c === 'string' ? c :
          '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      }) + '"' : '"' + this + '"';
  ;
    };

    def.$intern = function() {

      return this;
    };

    def.$lines = def.$each_line;

    def.$length = function() {

      return this.length;
    };

    def.$ljust = function(width, padstr) {
      if (padstr == null) {
        padstr = " "
      }

      var length = this.length;

      if (width <= length) {
        return this;
      }
      else {
        var index = -1, result = "";

        while (++index < (width - length)) {
          result += padstr;
        }

        return this + result.slice(0, width - length);
      }
    ;
    };

    def.$lstrip = function() {

      return this.replace(/^\s*/, '');
    };

    def.$match = TMP_4 = function(pattern, pos) {
      var $a, $b, $c, $d, $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      return ($a = ($b = (function() { if (($c = pattern['$is_a?']((($d = $scope.Regexp) == null ? $opal.cm("Regexp") : $d))) !== false && $c !== nil) {
        return pattern
      } else {
        return (new RegExp("" + (($c = $scope.Regexp) == null ? $opal.cm("Regexp") : $c).$escape(pattern)))
      }; return nil; }).call(this)).$match, $a._p = block.$to_proc(), $a).call($b, this, pos);
    };

    def.$next = function() {


      if (this.length === 0) {
        return "";
      }

      var initial = this.substr(0, this.length - 1);
      var last    = native_string.fromCharCode(this.charCodeAt(this.length - 1) + 1);

      return initial + last;
    ;
    };

    def.$ord = function() {

      return this.charCodeAt(0);
    };

    def.$partition = function(str) {


      var result = this.split(str);
      var splitter = (result[0].length === this.length ? "" : str);

      return [result[0], splitter, result.slice(1).join(str.toString())];
    ;
    };

    def.$reverse = function() {

      return this.split('').reverse().join('');
    };

    def.$rindex = function(search, offset) {
      var $a;

      var search_type = (search == null ? Opal.NilClass : search.constructor);
      if (search_type != native_string && search_type != RegExp) {
        var msg = "type mismatch: " + search_type + " given";
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new(msg));
      }

      if (this.length == 0) {
        return search.length == 0 ? 0 : nil;
      }

      var result = -1;
      if (offset != null) {
        if (offset < 0) {
          offset = this.length + offset;
        }

        if (search_type == native_string) {
          result = this.lastIndexOf(search, offset);
        }
        else {
          result = this.substr(0, offset + 1).$reverse().search(search);
          if (result !== -1) {
            result = offset - result;
          }
        }
      }
      else {
        if (search_type == native_string) {
          result = this.lastIndexOf(search);
        }
        else {
          result = this.$reverse().search(search);
          if (result !== -1) {
            result = this.length - 1 - result;
          }
        }
      }

      return result === -1 ? nil : result;

    };

    def.$rjust = function(width, padstr) {
      if (padstr == null) {
        padstr = " "
      }

      if (width <= this.length) {
          return this;
      }
      else {
        var n_chars = Math.floor(width - this.length)
        var n_patterns = Math.floor(n_chars/padstr.length);
        var result = Array(n_patterns + 1).join(padstr);
        var remaining = n_chars - result.length;
        return result + padstr.slice(0, remaining) + this;
      }
    ;
    };

    def.$rstrip = function() {

      return this.replace(/\s*$/, '');
    };

    def.$scan = TMP_5 = function(pattern) {
      var $a, $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;

      if (pattern.global) {
        // should we clear it afterwards too?
        pattern.lastIndex = 0;
      }
      else {
        // rewrite regular expression to add the global flag to capture pre/post match
        pattern = new RegExp(pattern.source, 'g' + (pattern.multiline ? 'm' : '') + (pattern.ignoreCase ? 'i' : ''));
      }

      var result = [];
      var match;

      while ((match = pattern.exec(this)) != null) {
        var match_data = (($a = $scope.MatchData) == null ? $opal.cm("MatchData") : $a).$new(pattern, match);
        if (block === nil) {
          match.length == 1 ? result.push(match[0]) : result.push(match.slice(1));
        }
        else {
          match.length == 1 ? block(match[0]) : block.apply(this, match.slice(1));
        }
      }

      return (block !== nil ? this : result);
    ;
    };

    def.$size = def.$length;

    def.$slice = def['$[]'];

    def.$split = function(pattern, limit) {
      var $a;if (pattern == null) {
        pattern = ((($a = $gvars[";"]) !== false && $a !== nil) ? $a : " ")
      }
      return this.split(pattern, limit);
    };

    def['$start_with?'] = function(prefixes) {
      prefixes = $slice.call(arguments, 0);

      for (var i = 0, length = prefixes.length; i < length; i++) {
        if (this.indexOf(prefixes[i]) === 0) {
          return true;
        }
      }

      return false;

    };

    def.$strip = function() {

      return this.replace(/^\s*/, '').replace(/\s*$/, '');
    };

    def.$sub = TMP_6 = function(pattern, replace) {
      var $a, $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;

      if (typeof(replace) === 'string') {
        // convert Ruby back reference to JavaScript back reference
        replace = replace.replace(/\\([1-9])/g, '$$$1')
        return this.replace(pattern, replace);
      }
      if (block !== nil) {
        return this.replace(pattern, function() {
          // FIXME: this should be a formal MatchData object with all the goodies
          var match_data = []
          for (var i = 0, len = arguments.length; i < len; i++) {
            var arg = arguments[i];
            if (arg == undefined) {
              match_data.push(nil);
            }
            else {
              match_data.push(arg);
            }
          }

          var str = match_data.pop();
          var offset = match_data.pop();
          var match_len = match_data.length;

          // $1, $2, $3 not being parsed correctly in Ruby code
          //for (var i = 1; i < match_len; i++) {
          //  __gvars[String(i)] = match_data[i];
          //}
          $gvars["&"] = match_data[0];
          $gvars["~"] = match_data;
          return block(match_data[0]);
        });
      }
      else if (replace !== undefined) {
        if (replace['$is_a?']((($a = $scope.Hash) == null ? $opal.cm("Hash") : $a))) {
          return this.replace(pattern, function(str) {
            var value = replace['$[]'](this.$str());

            return (value == null) ? nil : this.$value().$to_s();
          });
        }
        else {
          replace = (($a = $scope.String) == null ? $opal.cm("String") : $a).$try_convert(replace);

          if (replace == null) {
            this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "can't convert " + (replace.$class()) + " into String");
          }

          return this.replace(pattern, replace);
        }
      }
      else {
        // convert Ruby back reference to JavaScript back reference
        replace = replace.toString().replace(/\\([1-9])/g, '$$$1')
        return this.replace(pattern, replace);
      }
    ;
    };

    def.$succ = def.$next;

    def.$sum = function(n) {
      if (n == null) {
        n = 16
      }

      var result = 0;

      for (var i = 0, length = this.length; i < length; i++) {
        result += (this.charCodeAt(i) % ((1 << n) - 1));
      }

      return result;

    };

    def.$swapcase = function() {


      var str = this.replace(/([a-z]+)|([A-Z]+)/g, function($0,$1,$2) {
        return $1 ? $0.toUpperCase() : $0.toLowerCase();
      });

      if (this.constructor === native_string) {
        return str;
      }

      return this.$class().$new(str);
    ;
    };

    def.$to_a = function() {


      if (this.length === 0) {
        return [];
      }

      return [this];
    ;
    };

    def.$to_f = function() {


      var result = parseFloat(this);

      return isNaN(result) ? 0 : result;
    ;
    };

    def.$to_i = function(base) {
      if (base == null) {
        base = 10
      }

      var result = parseInt(this, base);

      if (isNaN(result)) {
        return 0;
      }

      return result;
    ;
    };

    def.$to_proc = function() {


      var name = '$' + this;

      return function(arg) {
        var meth = arg[name];
        return meth ? meth.call(arg) : arg.$method_missing(name);
      };
    ;
    };

    def.$to_s = function() {

      return this.toString();
    };

    def.$to_str = def.$to_s;

    def.$to_sym = def.$intern;

    def.$to_n = function() {

      return this.valueOf();
    };

    def.$tr = function(from, to) {


      if (from.length == 0 || from === to) {
        return this;
      }

      var subs = {};
      var from_chars = from.split('');
      var from_length = from_chars.length;
      var to_chars = to.split('');
      var to_length = to_chars.length;

      var inverse = false;
      var global_sub = null;
      if (from_chars[0] === '^') {
        inverse = true;
        from_chars.shift();
        global_sub = to_chars[to_length - 1]
        from_length -= 1;
      }

      var from_chars_expanded = [];
      var last_from = null;
      var in_range = false;
      for (var i = 0; i < from_length; i++) {
        var char = from_chars[i];
        if (last_from == null) {
          last_from = char;
          from_chars_expanded.push(char);
        }
        else if (char === '-') {
          if (last_from === '-') {
            from_chars_expanded.push('-');
            from_chars_expanded.push('-');
          }
          else if (i == from_length - 1) {
            from_chars_expanded.push('-');
          }
          else {
            in_range = true;
          }
        }
        else if (in_range) {
          var start = last_from.charCodeAt(0) + 1;
          var end = char.charCodeAt(0);
          for (var c = start; c < end; c++) {
            from_chars_expanded.push(native_string.fromCharCode(c));
          }
          from_chars_expanded.push(char);
          in_range = null;
          last_from = null;
        }
        else {
          from_chars_expanded.push(char);
        }
      }

      from_chars = from_chars_expanded;
      from_length = from_chars.length;

      if (inverse) {
        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = true;
        }
      }
      else {
        if (to_length > 0) {
          var to_chars_expanded = [];
          var last_to = null;
          var in_range = false;
          for (var i = 0; i < to_length; i++) {
            var char = to_chars[i];
            if (last_from == null) {
              last_from = char;
              to_chars_expanded.push(char);
            }
            else if (char === '-') {
              if (last_to === '-') {
                to_chars_expanded.push('-');
                to_chars_expanded.push('-');
              }
              else if (i == to_length - 1) {
                to_chars_expanded.push('-');
              }
              else {
                in_range = true;
              }
            }
            else if (in_range) {
              var start = last_from.charCodeAt(0) + 1;
              var end = char.charCodeAt(0);
              for (var c = start; c < end; c++) {
                to_chars_expanded.push(native_string.fromCharCode(c));
              }
              to_chars_expanded.push(char);
              in_range = null;
              last_from = null;
            }
            else {
              to_chars_expanded.push(char);
            }
          }

          to_chars = to_chars_expanded;
          to_length = to_chars.length;
        }

        var length_diff = from_length - to_length;
        if (length_diff > 0) {
          var pad_char = (to_length > 0 ? to_chars[to_length - 1] : '');
          for (var i = 0; i < length_diff; i++) {
            to_chars.push(pad_char);
          }
        }

        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = to_chars[i];
        }
      }

      var new_str = ''
      for (var i = 0, length = this.length; i < length; i++) {
        var char = this.charAt(i);
        var sub = subs[char];
        if (inverse) {
          new_str += (sub == null ? global_sub : char);
        }
        else {
          new_str += (sub != null ? sub : char);
        }
      }
      return new_str;
    ;
    };

    def.$tr_s = function(from, to) {


      if (from.length == 0) {
        return this;
      }

      var subs = {};
      var from_chars = from.split('');
      var from_length = from_chars.length;
      var to_chars = to.split('');
      var to_length = to_chars.length;

      var inverse = false;
      var global_sub = null;
      if (from_chars[0] === '^') {
        inverse = true;
        from_chars.shift();
        global_sub = to_chars[to_length - 1]
        from_length -= 1;
      }

      var from_chars_expanded = [];
      var last_from = null;
      var in_range = false;
      for (var i = 0; i < from_length; i++) {
        var char = from_chars[i];
        if (last_from == null) {
          last_from = char;
          from_chars_expanded.push(char);
        }
        else if (char === '-') {
          if (last_from === '-') {
            from_chars_expanded.push('-');
            from_chars_expanded.push('-');
          }
          else if (i == from_length - 1) {
            from_chars_expanded.push('-');
          }
          else {
            in_range = true;
          }
        }
        else if (in_range) {
          var start = last_from.charCodeAt(0) + 1;
          var end = char.charCodeAt(0);
          for (var c = start; c < end; c++) {
            from_chars_expanded.push(native_string.fromCharCode(c));
          }
          from_chars_expanded.push(char);
          in_range = null;
          last_from = null;
        }
        else {
          from_chars_expanded.push(char);
        }
      }

      from_chars = from_chars_expanded;
      from_length = from_chars.length;

      if (inverse) {
        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = true;
        }
      }
      else {
        if (to_length > 0) {
          var to_chars_expanded = [];
          var last_to = null;
          var in_range = false;
          for (var i = 0; i < to_length; i++) {
            var char = to_chars[i];
            if (last_from == null) {
              last_from = char;
              to_chars_expanded.push(char);
            }
            else if (char === '-') {
              if (last_to === '-') {
                to_chars_expanded.push('-');
                to_chars_expanded.push('-');
              }
              else if (i == to_length - 1) {
                to_chars_expanded.push('-');
              }
              else {
                in_range = true;
              }
            }
            else if (in_range) {
              var start = last_from.charCodeAt(0) + 1;
              var end = char.charCodeAt(0);
              for (var c = start; c < end; c++) {
                to_chars_expanded.push(native_string.fromCharCode(c));
              }
              to_chars_expanded.push(char);
              in_range = null;
              last_from = null;
            }
            else {
              to_chars_expanded.push(char);
            }
          }

          to_chars = to_chars_expanded;
          to_length = to_chars.length;
        }

        var length_diff = from_length - to_length;
        if (length_diff > 0) {
          var pad_char = (to_length > 0 ? to_chars[to_length - 1] : '');
          for (var i = 0; i < length_diff; i++) {
            to_chars.push(pad_char);
          }
        }

        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = to_chars[i];
        }
      }
      var new_str = ''
      var last_substitute = null
      for (var i = 0, length = this.length; i < length; i++) {
        var char = this.charAt(i);
        var sub = subs[char]
        if (inverse) {
          if (sub == null) {
            if (last_substitute == null) {
              new_str += global_sub;
              last_substitute = true;
            }
          }
          else {
            new_str += char;
            last_substitute = null;
          }
        }
        else {
          if (sub != null) {
            if (last_substitute == null || last_substitute !== sub) {
              new_str += sub;
              last_substitute = sub;
            }
          }
          else {
            new_str += char;
            last_substitute = null;
          }
        }
      }
      return new_str;
    ;
    };

    def.$upcase = function() {

      return this.toUpperCase();
    };

    def.$freeze = function() {

      return this;
    };

    def['$frozen?'] = function() {

      return true;
    };

    return nil;
  })(self, null);
  $scope.Symbol = (($a = $scope.String) == null ? $opal.cm("String") : $a);
  return (function($base, $super){
    function MatchData() {};
    MatchData = $klass($base, $super, "MatchData", MatchData);

    var def = MatchData._proto, $scope = MatchData._scope;

    MatchData.$attr_reader("post_match", "pre_match", "regexp", "string");

    MatchData.constructor.prototype['$new'] = function(regexp, match_groups) {


      var instance = new Opal.MatchData._alloc;
      for (var i = 0, len = match_groups.length; i < len; i++) {
        var group = match_groups[i];
        if (group == undefined) {
          instance.push(nil);
        }
        else {
          instance.push(group);
        }
      }
      instance._begin = match_groups.index;
      instance.regexp = regexp;
      instance.string = match_groups.input;
      instance.pre_match = $gvars["`"] = instance.string.substr(0, regexp.lastIndex - instance[0].length);
      instance.post_match = $gvars["'"] = instance.string.substr(regexp.lastIndex);
      return $gvars["~"] = instance;

    };

    def.$begin = function(pos) {
      var $a;

      if (pos == 0 || pos == 1) {
        return this._begin;
      }
      else {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "MatchData#begin only supports 0th element");
      }
    ;
    };

    def.$captures = function() {

      return this.slice(1);
    };

    def.$inspect = function() {


      var str = "<#MatchData " + this[0].$inspect()
      for (var i = 1, len = this.length; i < len; i++) {
        str += " " + i + ":" + this[i].$inspect();
      }
      str += ">";
      return str;
    ;
    };

    def.$to_s = function() {

      return this[0];
    };

    def.$to_n = function() {

      return this.valueOf();
    };

    def.$values_at = function(indexes) {
      indexes = $slice.call(arguments, 0);

      var vals = [];
      var match_length = this.length;
      for (var i = 0, length = indexes.length; i < length; i++) {
        var pos = indexes[i];
        if (pos >= 0) {
          vals.push(this[pos]);
        }
        else {
          pos = match_length + pos;
          if (pos > 0) {
            vals.push(this[pos]);
          }
          else {
            vals.push(nil);
          }
        }
      }

      return vals;

    };

    return nil;
  })(self, (($a = $scope.Array) == null ? $opal.cm("Array") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/string.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$enum_for', '$is_a?']);
  (function($base, $super){
    function Numeric() {};
    Numeric = $klass($base, $super, "Numeric", Numeric);

    var def = Numeric._proto, $scope = Numeric._scope, $a, TMP_1, TMP_2, TMP_3, TMP_4;

    Numeric.$include((($a = $scope.Comparable) == null ? $opal.cm("Comparable") : $a));

    def._isNumber = true;

    def['$+'] = function(other) {

      return this + other;
    };

    def['$-'] = function(other) {

      return this - other;
    };

    def['$*'] = function(other) {

      return this * other;
    };

    def['$/'] = function(other) {

      return this / other;
    };

    def['$%'] = function(other) {

      return this % other;
    };

    def['$&'] = function(other) {

      return this & other;
    };

    def['$|'] = function(other) {

      return this | other;
    };

    def['$^'] = function(other) {

      return this ^ other;
    };

    def['$<'] = function(other) {

      return this < other;
    };

    def['$<='] = function(other) {

      return this <= other;
    };

    def['$>'] = function(other) {

      return this > other;
    };

    def['$>='] = function(other) {

      return this >= other;
    };

    def['$<<'] = function(count) {

      return this << count;
    };

    def['$>>'] = function(count) {

      return this >> count;
    };

    def['$+@'] = function() {

      return +this;
    };

    def['$-@'] = function() {

      return -this;
    };

    def['$~'] = function() {

      return ~this;
    };

    def['$**'] = function(other) {

      return Math.pow(this, other);
    };

    def['$=='] = function(other) {

      return !!(other._isNumber) && this == Number(other);
    };

    def['$<=>'] = function(other) {


      if (typeof(other) !== 'number') {
        return nil;
      }

      return this < other ? -1 : (this > other ? 1 : 0);
    ;
    };

    def.$abs = function() {

      return Math.abs(this);
    };

    def.$ceil = function() {

      return Math.ceil(this);
    };

    def.$chr = function() {

      return String.fromCharCode(this);
    };

    def.$downto = TMP_1 = function(finish) {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;

      for (var i = this; i >= finish; i--) {
        if (block(i) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;
    ;
    };

    def['$eql?'] = def['$=='];

    def['$even?'] = function() {

      return this % 2 === 0;
    };

    def.$floor = function() {

      return Math.floor(this);
    };

    def.$hash = function() {

      return this.toString();
    };

    def['$integer?'] = function() {

      return this % 1 === 0;
    };

    def.$magnitude = def.$abs;

    def.$modulo = def['$%'];

    def.$next = function() {

      return this + 1;
    };

    def['$nonzero?'] = function() {

      return this === 0 ? nil : this;
    };

    def['$odd?'] = function() {

      return this % 2 !== 0;
    };

    def.$ord = function() {

      return this;
    };

    def.$pred = function() {

      return this - 1;
    };

    def.$step = TMP_2 = function(limit, step) {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;if (step == null) {
        step = 1
      }

      var working = this;

      if (step > 0) {
        while (working <= limit) {
          block(working);
          working += step;
        }
      }
      else {
        while (working >= limit) {
          block(working);
          working += step;
        }
      }

      return this;
    ;
    };

    def.$succ = def.$next;

    def.$times = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;

      for (var i = 0; i < this; i++) {
        if (block(i) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;

    };

    def.$to_f = function() {

      return parseFloat(this);
    };

    def.$to_i = function() {

      return parseInt(this);
    };

    def.$to_s = function(base) {
      if (base == null) {
        base = 10
      }
      return this.toString();
    };

    def.$to_n = function() {

      return this.valueOf();
    };

    def.$upto = TMP_4 = function(finish) {
      var $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      if (block === nil) {
        return this.$enum_for("upto", finish)
      };

      for (var i = this; i <= finish; i++) {
        if (block(i) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;
    ;
    };

    def['$zero?'] = function() {

      return this == 0;
    };

    def.$size = function() {

      return 4;
    };

    return nil;
  })(self, null);
  $scope.Fixnum = (($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a);
  (function($base, $super){
    function Integer() {};
    Integer = $klass($base, $super, "Integer", Integer);

    var def = Integer._proto, $scope = Integer._scope;

    Integer.constructor.prototype['$==='] = function(other) {
      var $a;
      return ($a = other['$is_a?']((($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a)), $a !== false && $a !== nil ? (other % 1) == 0 : $a)
    };

    return nil;
  })(self, (($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a));
  return (function($base, $super){
    function Float() {};
    Float = $klass($base, $super, "Float", Float);

    var def = Float._proto, $scope = Float._scope;

    Float.constructor.prototype['$==='] = function(other) {
      var $a;
      return ($a = other['$is_a?']((($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a)), $a !== false && $a !== nil ? (other % 1) != 0 : $a)
    };

    return nil;
  })(self, (($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/numeric.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs([]);
  (function($base, $super){
    function Proc() {};
    Proc = $klass($base, $super, "Proc", Proc);

    var def = Proc._proto, $scope = Proc._scope, TMP_1;

    def._isProc = true;

    def.is_lambda = true;

    Proc.constructor.prototype['$new'] = TMP_1 = function() {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;
      if (block === nil) { throw new Error("no block given"); }
      block.is_lambda = false;
      return block;
    };

    def.$call = function(args) {
      args = $slice.call(arguments, 0);

      var result = this.apply(null, args);

      if (result === $breaker) {
        return $breaker.$v;
      }

      return result;
    ;
    };

    def['$[]'] = def.$call;

    def.$to_proc = function() {

      return this;
    };

    def['$lambda?'] = function() {

      return !!this.is_lambda;
    };

    def.$arity = function() {

      return this.length - 1;
    };

    def.$to_n = function() {

      return this;
    };

    return nil;
  })(self, null);
  return (function($base, $super){
    function Method() {};
    Method = $klass($base, $super, "Method", Method);

    var def = Method._proto, $scope = Method._scope;

    return nil
  })(self, (($a = $scope.Proc) == null ? $opal.cm("Proc") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/proc.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$attr_reader', '$<=', '$exclude_end?', '$-', '$end', '$min', '$==', '$max', '$succ', '$===', '$eql?', '$begin', '$raise']);
  return (function($base, $super){
    function Range() {};
    Range = $klass($base, $super, "Range", Range);

    var def = Range._proto, $scope = Range._scope, $a, TMP_1;

    Range.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));


    Range._proto._isRange = true;

    Opal.range = function(beg, end, exc) {
      var range         = new Range._alloc;
          range.begin   = beg;
          range.end     = end;
          range.exclude = exc;

      return range;
    };


    Range.$attr_reader("begin");

    Range.$attr_reader("end");

    def.$initialize = function(min, max, exclude) {
      if (exclude == null) {
        exclude = false
      }
      this.begin = min;
      this.end = max;
      return this.exclude = exclude;
    };

    def['$=='] = function(other) {


      if (!other._isRange) {
        return false;
      }

      return this.exclude === other.exclude && this.begin == other.begin && this.end == other.end;
    ;
    };

    def['$==='] = function(obj) {

      return obj >= this.begin && (this.exclude ? obj < this.end : obj <= this.end);
    };

    def['$cover?'] = function(value) {
      var $a, $b;
      return (($a = (this.begin)['$<='](value)) ? value['$<=']((function() { if (($b = this['$exclude_end?']()) !== false && $b !== nil) {
        return (this.end)['$-'](1)
      } else {
        return this.end;
      }; return nil; }).call(this)) : $a);
    };

    def.$last = function() {

      return this.$end();
    };

    def.$each = TMP_1 = function() {
      var $a, $b, $c, $iter = TMP_1._p, block = $iter || nil, current = nil;TMP_1._p = null;
      current = this.$min();
      while (($b = ($c = current['$=='](this.$max()), ($c === nil || $c === false))) !== false && $b !== nil){if ($opal.$yield1(block, current) === $breaker) return $breaker.$v;
      current = current.$succ();};
      if (($a = this['$exclude_end?']()) === false || $a === nil) {
        if ($opal.$yield1(block, current) === $breaker) return $breaker.$v
      };
      return this;
    };

    def['$eql?'] = function(other) {
      var $a, $b;
      if (($a = (($b = $scope.Range) == null ? $opal.cm("Range") : $b)['$==='](other)) === false || $a === nil) {
        return false
      };
      return ($a = (($a = this['$exclude_end?']()['$=='](other['$exclude_end?']())) ? (this.begin)['$eql?'](other.$begin()) : $a), $a !== false && $a !== nil ? (this.end)['$eql?'](other.$end()) : $a);
    };

    def['$exclude_end?'] = function() {

      return this.exclude;
    };

    def['$include?'] = function(obj) {

      return obj >= this.begin && obj <= this.end;
    };

    def.$max = def.$end;

    def.$min = def.$begin;

    def['$member?'] = def['$include?'];

    def.$step = function(n) {
      var $a;if (n == null) {
        n = 1
      }
      return this.$raise((($a = $scope.NotImplementedError) == null ? $opal.cm("NotImplementedError") : $a));
    };

    def.$to_s = function() {

      return this.begin + (this.exclude ? '...' : '..') + this.end;
    };

    return def.$inspect = def.$to_s;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/range.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, days_of_week = nil, short_days = nil, short_months = nil, long_months = nil;

  $opal.add_stubs(['$include', '$allocate', '$+', '$to_f', '$-', '$<=>', '$is_a?', '$zero?']);
  days_of_week = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  short_days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  short_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  long_months = ["January", "Febuary", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (function($base, $super){
    function Time() {};
    Time = $klass($base, $super, "Time", Time);

    var def = Time._proto, $scope = Time._scope, $a;

    Time.$include((($a = $scope.Comparable) == null ? $opal.cm("Comparable") : $a));

    Time.constructor.prototype['$at'] = function(seconds, frac) {
      if (frac == null) {
        frac = 0
      }
      return new Date(seconds * 1000 + frac);
    };

    Time.constructor.prototype['$new'] = function(year, month, day, hour, minute, second, millisecond) {


      switch (arguments.length) {
        case 1:
          return new Date(year);
        case 2:
          return new Date(year, month - 1);
        case 3:
          return new Date(year, month - 1, day);
        case 4:
          return new Date(year, month - 1, day, hour);
        case 5:
          return new Date(year, month - 1, day, hour, minute);
        case 6:
          return new Date(year, month - 1, day, hour, minute, second);
        case 7:
          return new Date(year, month - 1, day, hour, minute, second, millisecond);
        default:
          return new Date();
      }

    };

    Time.constructor.prototype['$now'] = function() {

      return new Date();
    };

    Time.constructor.prototype['$parse'] = function(str) {

      return Date.parse(str);
    };

    def['$+'] = function(other) {
      var $a;
      return (($a = $scope.Time) == null ? $opal.cm("Time") : $a).$allocate(this.$to_f()['$+'](other.$to_f()));
    };

    def['$-'] = function(other) {
      var $a;
      return (($a = $scope.Time) == null ? $opal.cm("Time") : $a).$allocate(this.$to_f()['$-'](other.$to_f()));
    };

    def['$<=>'] = function(other) {

      return this.$to_f()['$<=>'](other.$to_f());
    };

    def.$day = function() {

      return this.getDate();
    };

    def['$eql?'] = function(other) {
      var $a;
      return ($a = other['$is_a?']((($a = $scope.Time) == null ? $opal.cm("Time") : $a)), $a !== false && $a !== nil ? this['$<=>'](other)['$zero?']() : $a);
    };

    def['$friday?'] = function() {

      return this.getDay() === 5;
    };

    def.$hour = function() {

      return this.getHours();
    };

    def.$inspect = function() {

      return this.toString();
    };

    def.$mday = def.$day;

    def.$min = function() {

      return this.getMinutes();
    };

    def.$mon = function() {

      return this.getMonth() + 1;
    };

    def['$monday?'] = function() {

      return this.getDay() === 1;
    };

    def.$month = def.$mon;

    def['$saturday?'] = function() {

      return this.getDay() === 6;
    };

    def.$sec = function() {

      return this.getSeconds();
    };

    def.$strftime = function(format) {
      if (format == null) {
        format = ""
      }

      var d = this;

      return format.replace(/%(-?.)/g, function(full, m) {
        switch (m) {
          case 'a': return short_days[d.getDay()];
          case 'A': return days_of_week[d.getDay()];
          case 'b': return short_months[d.getMonth()];
          case 'B': return long_months[d.getMonth()];
          case '-d': return d.getDate();
          case 'Y': return d.getFullYear();
          default: return m ;
        }
      });
    ;
    };

    def['$sunday?'] = function() {

      return this.getDay() === 0;
    };

    def['$thursday?'] = function() {

      return this.getDay() === 4;
    };

    def.$to_f = function() {

      return this.getTime() / 1000;
    };

    def.$to_i = function() {

      return parseInt(this.getTime() / 1000);
    };

    def.$to_s = def.$inspect;

    def['$tuesday?'] = function() {

      return this.getDay() === 2;
    };

    def.$wday = function() {

      return this.getDay();
    };

    def['$wednesday?'] = function() {

      return this.getDay() === 3;
    };

    def.$year = function() {

      return this.getFullYear();
    };

    def.$to_n = function() {

      return this;
    };

    return nil;
  })(self, null);
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/time.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$==', '$[]', '$upcase', '$const_set', '$new', '$unshift', '$define_struct_attribute', '$each', '$raise', '$<<', '$members', '$instance_variable_get', '$define_method', '$instance_variable_set', '$include', '$length', '$native?', '$Native', '$each_with_index', '$class', '$===', '$>=', '$size', '$include?', '$to_sym', '$enum_for', '$hash', '$all?', '$map', '$to_n', '$each_pair', '$+', '$name', '$join', '$inspect']);
  return (function($base, $super){
    function Struct() {};
    Struct = $klass($base, $super, "Struct", Struct);

    var def = Struct._proto, $scope = Struct._scope, TMP_1, $a, TMP_8, TMP_10;

    Struct.constructor.prototype['$new'] = TMP_1 = function(name, args) {
var $zuper = $slice.call(arguments, 0);      var $a, $b, TMP_2, $c, $d, $iter = TMP_1._p, $yield = $iter || nil;TMP_1._p = null;args = $slice.call(arguments, 1);
      if (($a = this['$==']((($b = $scope.Struct) == null ? $opal.cm("Struct") : $b))) === false || $a === nil) {
        return $opal.dispatch_super(this, "new",$zuper, $iter, Struct)
      };
      if (name['$[]'](0)['$=='](name['$[]'](0).$upcase())) {
        return (($a = $scope.Struct) == null ? $opal.cm("Struct") : $a).$const_set(name, ($a = this).$new.apply($a, [].concat(args)))
      } else {
        args.$unshift(name);
        return ($b = ($c = (($d = $scope.Class) == null ? $opal.cm("Class") : $d)).$new, $b._p = (TMP_2 = function() {

          var self = TMP_2._s || this, TMP_3, $a, $b;

          return ($a = ($b = args).$each, $a._p = (TMP_3 = function(arg) {

            var self = TMP_3._s || this;
            if (arg == null) arg = nil;

            return self.$define_struct_attribute(arg)
          }, TMP_3._s = self, TMP_3), $a).call($b)
        }, TMP_2._s = this, TMP_2), $b).call($c, this);
      };
    };

    Struct.constructor.prototype['$define_struct_attribute'] = function(name) {
      var $a, TMP_4, $b, TMP_5, $c;
      if (this['$==']((($a = $scope.Struct) == null ? $opal.cm("Struct") : $a))) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "you cannot define attributes to the Struct class")
      };
      this.$members()['$<<'](name);
      ($a = ($b = this).$define_method, $a._p = (TMP_4 = function() {

        var self = TMP_4._s || this;

        return self.$instance_variable_get("@" + (name))
      }, TMP_4._s = this, TMP_4), $a).call($b, name);
      return ($a = ($c = this).$define_method, $a._p = (TMP_5 = function(value) {

        var self = TMP_5._s || this;
        if (value == null) value = nil;

        return self.$instance_variable_set("@" + (name), value)
      }, TMP_5._s = this, TMP_5), $a).call($c, "" + (name) + "=");
    };

    Struct.constructor.prototype['$members'] = function() {
      var $a;
      if (this.members == null) this.members = nil;

      if (this['$==']((($a = $scope.Struct) == null ? $opal.cm("Struct") : $a))) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "the Struct class has no members")
      };
      return ((($a = this.members) !== false && $a !== nil) ? $a : this.members = []);
    };

    Struct.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));

    def.$initialize = function(args) {
      var $a, $b, TMP_6, TMP_7, $c, object = nil;args = $slice.call(arguments, 0);
      if (($a = (($b = args.$length()['$=='](1)) ? this['$native?'](args['$[]'](0)) : $b)) !== false && $a !== nil) {
        object = args['$[]'](0);
        return ($a = ($b = this.$members()).$each, $a._p = (TMP_6 = function(name) {

          var self = TMP_6._s || this;
          if (name == null) name = nil;

          return self.$instance_variable_set("@" + (name), self.$Native(object[name]))
        }, TMP_6._s = this, TMP_6), $a).call($b);
      } else {
        return ($a = ($c = this.$members()).$each_with_index, $a._p = (TMP_7 = function(name, index) {

          var self = TMP_7._s || this;
          if (name == null) name = nil;
if (index == null) index = nil;

          return self.$instance_variable_set("@" + (name), args['$[]'](index))
        }, TMP_7._s = this, TMP_7), $a).call($c)
      };
    };

    def.$members = function() {

      return this.$class().$members();
    };

    def['$[]'] = function(name) {
      var $a, $b;
      if (($a = (($b = $scope.Integer) == null ? $opal.cm("Integer") : $b)['$==='](name)) !== false && $a !== nil) {
        if (name['$>='](this.$members().$size())) {
          this.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a), "offset " + (name) + " too large for struct(size:" + (this.$members().$size()) + ")")
        };
        name = this.$members()['$[]'](name);
      } else {
        if (($a = this.$members()['$include?'](name.$to_sym())) === false || $a === nil) {
          this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "no member '" + (name) + "' in struct")
        }
      };
      return this.$instance_variable_get("@" + (name));
    };

    def['$[]='] = function(name, value) {
      var $a, $b;
      if (($a = (($b = $scope.Integer) == null ? $opal.cm("Integer") : $b)['$==='](name)) !== false && $a !== nil) {
        if (name['$>='](this.$members().$size())) {
          this.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a), "offset " + (name) + " too large for struct(size:" + (this.$members().$size()) + ")")
        };
        name = this.$members()['$[]'](name);
      } else {
        if (($a = this.$members()['$include?'](name.$to_sym())) === false || $a === nil) {
          this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "no member '" + (name) + "' in struct")
        }
      };
      return this.$instance_variable_set("@" + (name), value);
    };

    def.$each = TMP_8 = function() {
      var TMP_9, $a, $b, $iter = TMP_8._p, $yield = $iter || nil;TMP_8._p = null;
      if ($yield === nil) {
        return this.$enum_for("each")
      };
      return ($a = ($b = this.$members()).$each, $a._p = (TMP_9 = function(name) {

        var self = TMP_9._s || this, $a;
        if (name == null) name = nil;

        return $a = $opal.$yield1($yield, self['$[]'](name)), $a === $breaker ? $a : $a
      }, TMP_9._s = this, TMP_9), $a).call($b);
    };

    def.$each_pair = TMP_10 = function() {
      var TMP_11, $a, $b, $iter = TMP_10._p, $yield = $iter || nil;TMP_10._p = null;
      if ($yield === nil) {
        return this.$enum_for("each_pair")
      };
      return ($a = ($b = this.$members()).$each, $a._p = (TMP_11 = function(name) {

        var self = TMP_11._s || this, $a;
        if (name == null) name = nil;

        return $a = $opal.$yieldX($yield, [name, self['$[]'](name)]), $a === $breaker ? $a : $a
      }, TMP_11._s = this, TMP_11), $a).call($b);
    };

    def['$eql?'] = function(other) {
      var $a, TMP_12, $b, $c;
      return ((($a = this.$hash()['$=='](other.$hash())) !== false && $a !== nil) ? $a : ($b = ($c = other.$each_with_index())['$all?'], $b._p = (TMP_12 = function(object, index) {

        var self = TMP_12._s || this;
        if (object == null) object = nil;
if (index == null) index = nil;

        return self['$[]'](self.$members()['$[]'](index))['$=='](object)
      }, TMP_12._s = this, TMP_12), $b).call($c));
    };

    def.$length = function() {

      return this.$members().$length();
    };

    def.$size = def.$length;

    def.$to_a = function() {
      var TMP_13, $a, $b;
      return ($a = ($b = this.$members()).$map, $a._p = (TMP_13 = function(name) {

        var self = TMP_13._s || this;
        if (name == null) name = nil;

        return self['$[]'](name)
      }, TMP_13._s = this, TMP_13), $a).call($b);
    };

    def.$values = def.$to_a;

    def.$to_n = function() {
      var TMP_14, $a, $b, result = nil;
      result = {};
      ($a = ($b = this).$each_pair, $a._p = (TMP_14 = function(name, value) {

        var self = TMP_14._s || this;
        if (name == null) name = nil;
if (value == null) value = nil;

        return result[name] = value.$to_n();
      }, TMP_14._s = this, TMP_14), $a).call($b);
      return result;
    };

    def.$inspect = function() {
      var $a, TMP_15, $b, result = nil;
      result = "#<struct ";
      if (this.$class()['$==']((($a = $scope.Struct) == null ? $opal.cm("Struct") : $a))) {
        result = result['$+']("" + (this.$class().$name()) + " ")
      };
      result = result['$+'](($a = ($b = this.$each_pair()).$map, $a._p = (TMP_15 = function(name, value) {

        var self = TMP_15._s || this;
        if (name == null) name = nil;
if (value == null) value = nil;

        return "" + (name) + "=" + (value.$inspect())
      }, TMP_15._s = this, TMP_15), $a).call($b).$join(", "));
      result = result['$+'](">");
      return result;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/struct.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $klass = $opal.klass;

  $opal.add_stubs(['$native?', '$new', '$call', '$define_method', '$extend', '$instance_eval', '$raise', '$respond_to?', '$to_n', '$try_convert', '$<<', '$Native', '$include', '$nil?', '$[]=', '$slice', '$-', '$length', '$[]', '$to_proc']);
  (function($base){
    function Kernel() {};
    Kernel = $module($base, "Kernel", Kernel);
    var def = Kernel._proto, $scope = Kernel._scope;

    def['$native?'] = function(value) {

      return value == null || !value._klass;
    };

    def.$Native = function(obj) {
      var $a;
      if (($a = this['$native?'](obj)) !== false && $a !== nil) {
        return (($a = $scope.Native) == null ? $opal.cm("Native") : $a).$new(obj)
      } else {
        return obj
      };
    };
    ;$opal.donate(Kernel, ["$native?", "$Native"]);
  })(self);
  return (function($base, $super){
    function Native() {};
    Native = $klass($base, $super, "Native", Native);

    var def = Native._proto, $scope = Native._scope, TMP_3, $a, TMP_4, TMP_5;
    def['native'] = nil;

    (function($base){
      function Base() {};
      Base = $module($base, "Base", Base);
      var def = Base._proto, $scope = Base._scope;

      (function($base){
        function Helpers() {};
        Helpers = $module($base, "Helpers", Helpers);
        var def = Helpers._proto, $scope = Helpers._scope;

        def.$alias_native = function(new$, old) {
          var TMP_1, $a, $b;
          return ($a = ($b = this).$define_method, $a._p = (TMP_1 = function(args) {

            var self = TMP_1._s || this, $a, $b;
            if (self['native'] == null) self['native'] = nil;

            args = $slice.call(arguments, 0);
            return ($a = (($b = $scope.Native) == null ? $opal.cm("Native") : $b)).$call.apply($a, [self['native'], old].concat(args))
          }, TMP_1._s = this, TMP_1), $a).call($b, new$);
        }
        ;$opal.donate(Helpers, ["$alias_native"]);
      })(Base);

      Base.constructor.prototype['$included'] = function(klass) {
        var TMP_2, $a, $b;
        return ($a = ($b = klass).$instance_eval, $a._p = (TMP_2 = function() {

          var self = TMP_2._s || this, $a;

          return self.$extend((($a = $scope.Helpers) == null ? $opal.cm("Helpers") : $a))
        }, TMP_2._s = this, TMP_2), $a).call($b)
      };

      def.$initialize = function(native$) {
        var $a;
        if (($a = this['$native?'](native$)) === false || $a === nil) {
          this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "the passed value isn't native")
        };
        return this['native'] = native$;
      };

      def.$to_n = function() {

        if (this['native'] == null) this['native'] = nil;

        return this['native'];
      };
      ;$opal.donate(Base, ["$initialize", "$to_n"]);
    })(Native);

    Native.constructor.prototype['$try_convert'] = function(value) {


      if (this['$native?'](value)) {
        return value.valueOf();
      }
      else if (value['$respond_to?']("to_n")) {
        return value.$to_n();
      }
      else {
        return nil;
      }
    ;
    };

    Native.constructor.prototype['$convert'] = function(value) {
      var $a, native$ = nil;
      native$ = this.$try_convert(value);
      if (($a = native$ === nil) !== false && $a !== nil) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "the passed value isn't a native")
      };
      return native$;
    };

    Native.constructor.prototype['$call'] = TMP_3 = function(obj, key, args) {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;args = $slice.call(arguments, 2);
      if (block !== false && block !== nil) {
        args['$<<'](block)
      };

      var prop = obj[key];

      if (prop == null) {
        return nil;
      }
      else if (prop instanceof Function) {
        var result = prop.apply(obj, args);

        return result == null ? nil : result;
      }
      else if (this['$native?'](prop)) {
        return this.$Native(prop);
      }
      else {
        return prop;
      }
    ;
    };

    Native.$include((($a = $scope.Base) == null ? $opal.cm("Base") : $a));

    def['$nil?'] = function() {

      return this['native'] == null;
    };

    def.$each = TMP_4 = function() {
      var $a, $iter = TMP_4._p, $yield = $iter || nil;TMP_4._p = null;
      if ($yield === nil) {
        return (($a = $scope.Enumerator) == null ? $opal.cm("Enumerator") : $a).$new(this, "each")
      };

      for (var key in this['native']) {
        if ($opal.$yieldX($yield, [key, this['native'][key]]) === $breaker) return $breaker.$v
      }
    ;
      return this;
    };

    def['$[]'] = function(key) {
      var $a;
      if (($a = this['$nil?']()) !== false && $a !== nil) {
        this.$raise("cannot get value from nil native")
      };

      var prop = this['native'][key];

      if (prop instanceof Function) {
        return prop;
      }
      else {
        return (($a = $opal.Object._scope.Native) == null ? $opal.cm('Native') : $a).$call(this['native'], key)
      }
    ;
    };

    def['$[]='] = function(key, value) {
      var $a, native$ = nil;
      if (($a = this['$nil?']()) !== false && $a !== nil) {
        this.$raise("cannot set value on nil native")
      };
      native$ = (($a = $scope.Native) == null ? $opal.cm("Native") : $a).$try_convert(value);
      if (($a = native$ === nil) !== false && $a !== nil) {
        return this['native'][key] = value;
      } else {
        return this['native'][key] = native$;
      };
    };

    def.$method_missing = TMP_5 = function(mid, args) {
      var $a, $b, $c, $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;args = $slice.call(arguments, 1);
      if (($a = this['$nil?']()) !== false && $a !== nil) {
        this.$raise("cannot call method from nil native")
      };

      if (mid.charAt(mid.length - 1) === '=') {
        return this['$[]='](mid.$slice(0, mid.$length()['$-'](1)), args['$[]'](0));
      }
      else {
        return ($a = ($b = (($c = $opal.Object._scope.Native) == null ? $opal.cm('Native') : $c)).$call, $a._p = block.$to_proc(), $a).apply($b, [this['native'], mid].concat(args));
      }
    ;
    };

    return nil;
  })(self, (($a = $scope.BasicObject) == null ? $opal.cm("BasicObject") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/native.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, $module = $opal.module, $gvars = $opal.gvars;

  $opal.add_stubs(['$write', '$join', '$String', '$map', '$getbyte', '$getc', '$raise']);
  return (function($base, $super){
    function IO() {};
    IO = $klass($base, $super, "IO", IO);

    var def = IO._proto, $scope = IO._scope;

    $scope.SEEK_SET = 0;

    $scope.SEEK_CUR = 1;

    $scope.SEEK_END = 2;

    (function($base){
      function Writable() {};
      Writable = $module($base, "Writable", Writable);
      var def = Writable._proto, $scope = Writable._scope;

      def['$<<'] = function(string) {

        this.$write(string);
        return this;
      };

      def.$print = function(args) {
        var TMP_1, $a, $b;args = $slice.call(arguments, 0);
        return this.$write(($a = ($b = args).$map, $a._p = (TMP_1 = function(arg) {

          var self = TMP_1._s || this;
          if (arg == null) arg = nil;

          return self.$String(arg)
        }, TMP_1._s = this, TMP_1), $a).call($b).$join($gvars[","]));
      };

      def.$puts = function(args) {
        var TMP_2, $a, $b;args = $slice.call(arguments, 0);
        return this.$write(($a = ($b = args).$map, $a._p = (TMP_2 = function(arg) {

          var self = TMP_2._s || this;
          if (arg == null) arg = nil;

          return self.$String(arg)
        }, TMP_2._s = this, TMP_2), $a).call($b).$join($gvars["/"]));
      };
      ;$opal.donate(Writable, ["$<<", "$print", "$puts"]);
    })(IO);

    return (function($base){
      function Readable() {};
      Readable = $module($base, "Readable", Readable);
      var def = Readable._proto, $scope = Readable._scope;

      def.$readbyte = function() {

        return this.$getbyte();
      };

      def.$readchar = function() {

        return this.$getc();
      };

      def.$readline = function(sep) {
        var $a;if (sep == null) {
          sep = $gvars["/"]
        }
        return this.$raise((($a = $scope.NotImplementedError) == null ? $opal.cm("NotImplementedError") : $a));
      };

      def.$readpartial = function(integer, outbuf) {
        var $a;if (outbuf == null) {
          outbuf = nil
        }
        return this.$raise((($a = $scope.NotImplementedError) == null ? $opal.cm("NotImplementedError") : $a));
      };
      ;$opal.donate(Readable, ["$readbyte", "$readchar", "$readline", "$readpartial"]);
    })(IO);
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/io.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $gvars = $opal.gvars, $hash2 = $opal.hash2;

  $opal.add_stubs(['$Native', '$new', '$puts', '$to_s', '$include']);
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  $gvars["&"] = $gvars["~"] = $gvars["`"] = $gvars["'"] = nil;
  $gvars[":"] = [];
  $gvars["/"] = "\n";
  $gvars[","] = " ";
  $gvars["$"] = $gvars["global"] = self.$Native(Opal.global);
  $scope.ARGV = [];
  $scope.ARGF = (($a = $scope.Object) == null ? $opal.cm("Object") : $a).$new();
  $scope.ENV = $hash2([], {});
  $scope.TRUE = true;
  $scope.FALSE = false;
  $scope.NIL = nil;
  $scope.STDERR = $gvars["stderr"] = (($a = $scope.IO) == null ? $opal.cm("IO") : $a).$new();
  $scope.STDIN = $gvars["stdin"] = (($a = $scope.IO) == null ? $opal.cm("IO") : $a).$new();
  $scope.STDOUT = $gvars["stdout"] = (($a = $scope.IO) == null ? $opal.cm("IO") : $a).$new();
  $gvars["stdout"].$puts = function(strs) {
    var $a;strs = $slice.call(arguments, 0);

    for (var i = 0; i < strs.length; i++) {
      if(strs[i] instanceof Array) {
        ($a = this).$puts.apply($a, [].concat((strs[i])))
      } else {
        $opal.puts((strs[i]).$to_s());
      }
    }
  ;
    return nil;
  };
  $scope.RUBY_PLATFORM = "opal";
  $scope.RUBY_ENGINE = "opal";
  $scope.RUBY_VERSION = "1.9.3";
  $scope.RUBY_ENGINE_VERSION = "0.4.4";
  $scope.RUBY_RELEASE_DATE = "2013-08-13";
  self.$to_s = function() {

    return "main"
  };
  return self.$include = function(mod) {
    var $a;
    return (($a = $scope.Object) == null ? $opal.cm("Object") : $a).$include(mod)
  };
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/opal.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var TMP_1, TMP_4, TMP_6, self = $opal.top, $scope = $opal, nil = $opal.nil, def = $opal.Object._proto, $breaker = $opal.breaker, $slice = $opal.slice, $hash2 = $opal.hash2;

  $opal.add_stubs(['$raise', '$const_set', '$class', '$attr_accessor', '$name', '$is_a?', '$send', '$each_pair', '$puts', '$new', '$const_get', '$attributes=', '$[]=', '$call', '$[]', '$block_given?', '$scene_def', '$lambda', '$scene_run']);
  ;
  def.$entity = TMP_1 = function(class_sym) {
    var TMP_2, $a, $b, $c, $iter = TMP_1._p, $yield = $iter || nil, klass = nil;TMP_1._p = null;
    if ($yield === nil) {
      this.$raise()
    };
    this.$class().$const_set(class_sym, ($a = ($b = (($c = $scope.Class) == null ? $opal.cm("Class") : $c)).$new, $a._p = (TMP_2 = function() {

      var self = TMP_2._s || this;

      return (function(){var $scope = this._scope, def = this._proto;this.$attr_accessor("name");
      def.$attributes = function() {

        return $hash2(["name"], {"name": this.$name()});
      };
      def['$attributes='] = function(attributes) {
        var $a, $b, TMP_3;
        if (($a = attributes['$is_a?']((($b = $scope.Hash) == null ? $opal.cm("Hash") : $b))) === false || $a === nil) {
          this.$raise()
        };
        return ($a = ($b = attributes).$each_pair, $a._p = (TMP_3 = function(key, value) {

          var self = TMP_3._s || this;
          if (key == null) key = nil;
if (value == null) value = nil;

          return self.$send("" + (key) + "=", value)
        }, TMP_3._s = this, TMP_3), $a).call($b);
      };
      return def.$talk = function(text) {

        return this.$puts("[" + (this.$name()) + "] " + (text));
      };}).call(self.$singleton_class())
    }, TMP_2._s = this, TMP_2), $a).call($b));
    klass = this.$class().$const_get(class_sym);
    klass['$attributes='](((($a = $opal.$yieldX($yield, [])) === $breaker) ? $breaker.$v : $a));
    return klass;
  };
  self.scene_map = $hash2([], {});
  def.$scene_def = function(scene_name, block) {

    if (this.scene_map == null) this.scene_map = nil;

    return this.scene_map['$[]='](scene_name, block);
  };
  def.$scene_run = function(scene_name) {

    if (this.scene_map == null) this.scene_map = nil;

    return this.scene_map['$[]'](scene_name).$call();
  };
  def.$scene = TMP_4 = function(scene_name) {
    var TMP_5, $a, $b, $iter = TMP_4._p, $yield = $iter || nil;TMP_4._p = null;
    if (($yield !== nil)) {
      return this.$scene_def(scene_name, ($a = ($b = this).$lambda, $a._p = (TMP_5 = function() {

        var self = TMP_5._s || this, $a;

        return $a = $opal.$yieldX($yield, []), $a === $breaker ? $a : $a
      }, TMP_5._s = this, TMP_5), $a).call($b))
    } else {
      return this.$scene_run(scene_name)
    };
  };
  return def.$chapter = TMP_6 = function(chapter_name) {
    var $a, $iter = TMP_6._p, $yield = $iter || nil;TMP_6._p = null;
    return $a = $opal.$yieldX($yield, []), $a === $breaker ? $a : $a;
  };
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/lemonade.js.map
;
(function(undefined) {
  // The Opal object that is exposed globally
  var Opal = this.Opal = {};

  // Very root class
  function BasicObject(){}

  // Core Object class
  function Object(){}

  // Class' class
  function Class(){}

  // Module's class
  function Module(){}

  // the class of nil
  function NilClass(){}

  // TopScope is used for inheriting constants from the top scope
  var TopScope = function(){};

  // Opal just acts as the top scope
  TopScope.prototype = Opal;

  // To inherit scopes
  Opal.constructor  = TopScope;

  // This is a useful reference to global object inside ruby files
  Opal.global = this;

  // Minify common function calls
  var $hasOwn = Opal.hasOwnProperty;
  var $slice  = Opal.slice = Array.prototype.slice;

  // Generates unique id for every ruby object
  var unique_id = 0;

  // Return next unique id
  Opal.uid = function() {
    return unique_id++;
  };

  // Table holds all class variables
  Opal.cvars = {};

  // Globals table
  Opal.gvars = {};

  /*
   * Create a new constants scope for the given class with the given
   * base. Constants are looked up through their parents, so the base
   * scope will be the outer scope of the new klass.
   */
  function create_scope(base, klass, id) {
    var const_alloc   = function() {};
    var const_scope   = const_alloc.prototype = new base.constructor();
    klass._scope      = const_scope;
    const_scope.base  = klass;
    const_scope.constructor = const_alloc;

    if (id) {
      base[id] = base.constructor[id] = klass;
    }
  }

  Opal.klass = function(base, superklass, id, constructor) {
    var klass;

    if (!base._isClass) {
      base = base._klass;
    }

    if (superklass === null) {
      superklass = ObjectClass;
    }

    if ($hasOwn.call(base._scope, id)) {
      klass = base._scope[id];

      if (!klass._isClass) {
        throw Opal.TypeError.$new(id + " is not a class");
      }

      if (superklass !== klass._super && superklass !== ObjectClass) {
        throw Opal.TypeError.$new("superclass mismatch for class " + id);
      }
    }
    else {
      klass = boot_class(superklass, constructor);

      klass._name = (base === ObjectClass ? id : base._name + '::' + id);

      create_scope(base._scope, klass);

      base[id] = base._scope[id] = klass;

      if (superklass.$inherited) {
        superklass.$inherited(klass);
      }
    }

    return klass;
  };

  // Define new module (or return existing module)
  Opal.module = function(base, id, constructor) {
    var klass;

    if (!base._isClass) {
      base = base._klass;
    }

    if ($hasOwn.call(base._scope, id)) {
      klass = base._scope[id];

      if (!klass._mod$ && klass !== ObjectClass) {
        throw Opal.TypeError.$new(id + " is not a module")
      }
    }
    else {
      klass = boot_class(ClassClass, constructor);
      klass._name = (base === ObjectClass ? id : base._name + '::' + id);
      klass._mod$ = true;

      klass._included_in = [];

      create_scope(base._scope, klass, id);
    }

    return klass;
  };

  // Boot a base class (makes instances).
  var boot_defclass = function(id, constructor, superklass) {
    if (superklass) {
      var ctor           = function() {};
          ctor.prototype = superklass.prototype;

      constructor.prototype = new ctor();
    }

    var prototype = constructor.prototype;

    prototype.constructor = constructor;

    return constructor;
  };

  // Boot the actual (meta?) classes of core classes
  var boot_makemeta = function(id, klass, superklass) {
    function RubyClass() {
      this._id = unique_id++;
    };

    var ctor            = function() {};
        ctor.prototype  = superklass.prototype;

    RubyClass.prototype = new ctor();

    var prototype         = RubyClass.prototype;
    prototype._alloc      = klass;
    prototype._isClass    = true;
    prototype._name       = id;
    prototype._super      = superklass;
    prototype.constructor = RubyClass;
    prototype._methods    = [];

    var result = new RubyClass();
    klass.prototype._klass = result;
    result._proto = klass.prototype;

    Opal[id] = result;

    return result;
  };

  // Create generic class with given superclass.
  var boot_class = Opal.boot = function(superklass, constructor) {
    // instances
    var ctor = function() {};
        ctor.prototype = superklass._proto;

    constructor.prototype = new ctor();
    var prototype = constructor.prototype;

    prototype.constructor = constructor;

    // class itself
    function OpalClass() {
      this._id = unique_id++;
    };

    var mtor = function() {};
        mtor.prototype = superklass.constructor.prototype;

    OpalClass.prototype = new mtor();

    prototype = OpalClass.prototype;
    prototype._alloc = constructor;
    prototype._isClass = true;
    prototype.constructor = OpalClass;
    prototype._super = superklass;
    prototype._methods = [];

    var result = new OpalClass();
    constructor.prototype._klass = result;

    result._proto = constructor.prototype;

    return result;

    return constructor;
  };

  var bridge_class = function(name, constructor) {
    var klass = boot_class(ObjectClass, constructor);
    var i, length, m;

    constructor.prototype.constructor = constructor;

    constructor._super        = Object;
    constructor.constructor   = Class;
    constructor._methods      = [];

    bridged_classes.push(klass);

    var table = ObjectClass._proto, methods = ObjectClass._methods;

    for (i = 0, length = methods.length; i < length; i++) {
      m = methods[i];
      constructor.prototype[m] = table[m];
    }

    klass._name = name;
    create_scope(Opal, klass, name);

    return klass;
  };

  Opal.puts = function(a) { console.log(a); };

  Opal.add_stubs = function(stubs) {
    for (var i = 0, length = stubs.length; i < length; i++) {
      var stub = stubs[i];

      if (!BasicObject.prototype[stub]) {
        BasicObject.prototype[stub] = true;
        add_stub_for(BasicObject.prototype, stub);
      }
    }
  };

  function add_stub_for(prototype, stub) {
    function method_missing_stub() {
      this.$method_missing._p = method_missing_stub._p;
      method_missing_stub._p = null;

      return this.$method_missing.apply(this, [stub.slice(1)].concat($slice.call(arguments)));
    }

    method_missing_stub.rb_stub = true;
    prototype[stub] = method_missing_stub;
  }

  Opal.add_stub_for = add_stub_for;

  // Const missing dispatcher
  Opal.cm = function(name) {
    return this.base.$const_missing(name);
  };

  // Arity count error dispatcher
  Opal.ac = function(actual, expected, object, meth) {
    var inspect = ((typeof(object) !== 'function') ? object.constructor._name + '#' : object._name + '.') + meth;
    var msg = '[' + inspect + '] wrong number of arguments(' + actual + ' for ' + expected + ')';
    throw Opal.ArgumentError.$new(msg);
  };

  // Super dispatcher
  Opal.dispatch_super = function(obj, jsid, args, iter, defs) {
    var dispatcher;

    if (defs) {
      dispatcher = obj._isClass ? defs._super : obj._klass._proto;
    }
    else {
      dispatcher = obj._isClass ? obj._klass : obj._klass._super._proto;
    }

    dispatcher = dispatcher['$' + jsid];
    dispatcher._p = iter;

    return dispatcher.apply(obj, args);
  };

  // return helper
  Opal.$return = function(val) {
    Opal.returner.$v = val;
    throw Opal.returner;
  };

  // handles yield calls for 1 yielded arg
  Opal.$yield1 = function(block, arg) {
    if (typeof(block) !== "function") {
      throw Opal.LocalJumpError.$new("no block given");
    }

    if (block.length > 1) {
      if (arg._isArray) {
        return block.apply(null, arg);
      }
      else {
        return block(arg);
      }
    }
    else {
      return block(arg);
    }
  };

  // handles yield for > 1 yielded arg
  Opal.$yieldX = function(block, args) {
    if (block.length > 1 && args.length == 1) {
      if (args[0]._isArray) {
        return block.apply(null, args[0]);
      }
    }

    return block.apply(null, args);
  };

  /*
    Call a ruby method on a ruby object with some arguments:

      var my_array = [1, 2, 3, 4]
      Opal.send(my_array, 'length')     # => 4
      Opal.send(my_array, 'reverse!')   # => [4, 3, 2, 1]

    A missing method will be forwarded to the object via
    method_missing.

    The result of either call with be returned.

    @param [Object] recv the ruby object
    @param [String] mid ruby method to call
  */
  Opal.send = function(recv, mid) {
    var args = $slice.call(arguments, 2),
        func = recv['$' + mid];

    if (func) {
      return func.apply(recv, args);
    }

    return recv.$method_missing.apply(recv, [mid].concat(args));
  };

  Opal.block_send = function(recv, mid, block) {
    var args = $slice.call(arguments, 3),
        func = recv['$' + mid];

    if (func) {
      func._p = block;
      return func.apply(recv, args);
    }

    return recv.$method_missing.apply(recv, [mid].concat(args));
  };

  /**
   * Donate methods for a class/module
   */
  Opal.donate = function(klass, defined, indirect) {
    var methods = klass._methods, included_in = klass._included_in;

    // if (!indirect) {
      klass._methods = methods.concat(defined);
    // }

    if (included_in) {
      for (var i = 0, length = included_in.length; i < length; i++) {
        var includee = included_in[i];
        var dest = includee._proto;

        for (var j = 0, jj = defined.length; j < jj; j++) {
          var method = defined[j];
          dest[method] = klass._proto[method];
        }

        if (includee._included_in) {
          Opal.donate(includee, defined, true);
        }
      }
    }
  };

  // Initialization
  // --------------

  // Constructors for *instances* of core objects
  boot_defclass('BasicObject', BasicObject);
  boot_defclass('Object', Object, BasicObject);
  boot_defclass('Module', Module, Object);
  boot_defclass('Class', Class, Module);

  // Constructors for *classes* of core objects
  var BasicObjectClass = boot_makemeta('BasicObject', BasicObject, Class);
  var ObjectClass      = boot_makemeta('Object', Object, BasicObjectClass.constructor);
  var ModuleClass      = boot_makemeta('Module', Module, ObjectClass.constructor);
  var ClassClass       = boot_makemeta('Class', Class, ModuleClass.constructor);

  // Fix booted classes to use their metaclass
  BasicObjectClass._klass = ClassClass;
  ObjectClass._klass = ClassClass;
  ModuleClass._klass = ClassClass;
  ClassClass._klass = ClassClass;

  // Fix superclasses of booted classes
  BasicObjectClass._super = null;
  ObjectClass._super = BasicObjectClass;
  ModuleClass._super = ObjectClass;
  ClassClass._super = ModuleClass;

  // Defines methods onto Object (which are then donated to bridged classes)
  ObjectClass._defn = function (mid, body) {
    this._proto[mid] = body;
    Opal.donate(this, [mid]);
  };

  var bridged_classes = ObjectClass._included_in = [];

  Opal.base = ObjectClass;
  BasicObjectClass._scope = ObjectClass._scope = Opal;
  Opal.Kernel = ObjectClass;

  create_scope(Opal, ModuleClass);
  create_scope(Opal, ClassClass);

  ObjectClass._proto.toString = function() {
    return this.$to_s();
  };

  ClassClass._proto._defn = function(mid, body) { this._proto[mid] = body; };

  Opal.top = new ObjectClass._alloc();

  Opal.klass(ObjectClass, ObjectClass, 'NilClass', NilClass);

  var nil = Opal.nil = new NilClass;
  nil.call = nil.apply = function() { throw Opal.LocalJumpError.$new('no block given'); };

  Opal.breaker  = new Error('unexpected break');
  Opal.returner = new Error('unexpected return');

  bridge_class('Array', Array);
  bridge_class('Boolean', Boolean);
  bridge_class('Numeric', Number);
  bridge_class('String', String);
  bridge_class('Proc', Function);
  bridge_class('Exception', Error);
  bridge_class('Regexp', RegExp);
  bridge_class('Time', Date);

  TypeError._super = Error;
}).call(this);
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$attr_reader', '$attr_writer', '$=~', '$raise', '$const_missing', '$to_str', '$name', '$append_features', '$included']);
  return (function($base, $super){
    function Module() {};
    Module = $klass($base, $super, "Module", Module);

    var def = Module._proto, $scope = Module._scope, TMP_1, TMP_2, TMP_3;

    Module.constructor.prototype['$new'] = TMP_1 = function() {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;

      function AnonModule(){}
      var klass = Opal.boot(Module, AnonModule);
      klass._name = nil;
      klass._scope = Module._scope;
      klass._klass = Module;

      if (block !== nil) {
        var block_self = block._s;
        block._s = null;
        block.call(klass);
        block._s = block_self;
      }

      return klass;

    };

    def['$==='] = function(object) {


      if (object == null) {
        return false;
      }

      var search = object._klass;

      while (search) {
        if (search === this) {
          return true;
        }

        search = search._super;
      }

      return false;

    };

    def.$alias_method = function(newname, oldname) {

      this._proto['$' + newname] = this._proto['$' + oldname];
      return this;
    };

    def.$alias_native = function(mid, jsid) {

      return this._proto['$' + mid] = this._proto[jsid];
    };

    def.$ancestors = function() {


      var parent = this,
          result = [];

      while (parent) {
        result.push(parent);
        parent = parent._super;
      }

      return result;
    ;
    };

    def.$append_features = function(klass) {


      var module = this;

      if (!klass.$included_modules) {
        klass.$included_modules = [];
      }

      for (var idx = 0, length = klass.$included_modules.length; idx < length; idx++) {
        if (klass.$included_modules[idx] === module) {
          return;
        }
      }

      klass.$included_modules.push(module);

      if (!module._included_in) {
        module._included_in = [];
      }

      module._included_in.push(klass);

      var donator   = module._proto,
          prototype = klass._proto,
          methods   = module._methods;

      for (var i = 0, length = methods.length; i < length; i++) {
        var method = methods[i];
        prototype[method] = donator[method];
      }

      // if (prototype._smethods) {
      //  prototype._smethods.push.apply(prototype._smethods, methods);
      //}

      if (klass._included_in) {
        $opal.donate(klass, methods.slice(), true);
      }
    ;
      return this;
    };

    def.$attr_accessor = function(names) {
      var $a, $b;names = $slice.call(arguments, 0);
      ($a = this).$attr_reader.apply($a, [].concat(names));
      return ($b = this).$attr_writer.apply($b, [].concat(names));
    };

    def.$attr_reader = function(names) {
      names = $slice.call(arguments, 0);

      var proto = this._proto, cls = this;
      for (var i = 0, length = names.length; i < length; i++) {
        (function(name) {
          proto[name] = nil;
          var func = function() { return this[name] };

          if (cls._isSingleton) {
            proto.constructor.prototype['$' + name] = func;
          }
          else {
            proto['$' + name] = func;
          }
        })(names[i]);
      }
    ;
      return nil;
    };

    def.$attr_writer = function(names) {
      names = $slice.call(arguments, 0);

      var proto = this._proto, cls = this;
      for (var i = 0, length = names.length; i < length; i++) {
        (function(name) {
          proto[name] = nil;
          var func = function(value) { return this[name] = value; };

          if (cls._isSingleton) {
            proto.constructor.prototype['$' + name + '='] = func;
          }
          else {
            proto['$' + name + '='] = func;
          }
        })(names[i]);
      }
    ;
      return nil;
    };

    def.$attr = def.$attr_accessor;

    def.$constants = function() {


      var result = [];
      var name_re = /^[A-Z][A-Za-z0-9_]+$/;
      var scopes = [this._scope];
      var own_only;
      if (this === Opal.Class || this === Opal.Module) {
        own_only = false;
      }
      else {
        own_only = true;
        var parent = this._super;
        while (parent && (parent !== Opal.Object)) {
          scopes.push(parent._scope);
          parent = parent._super;
        }
      }
      for (var i = 0, len = scopes.length; i < len; i++) {
        var scope = scopes[i];
        for (name in scope) {
          if ((!own_only || scope.hasOwnProperty(name)) && name_re.test(name)) {
            result.push(name);
          }
        }
      }

      return result;
    ;
    };

    def['$const_defined?'] = function(name, inherit) {
      var $a;if (inherit == null) {
        inherit = true
      }
      if (($a = name['$=~'](/^[A-Z]\w+$/)) === false || $a === nil) {
        this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "wrong constant name " + (name))
      };

      scopes = [this._scope];
      if (inherit || this === Opal.Object) {
        var parent = this._super;
        while (parent !== Opal.BasicObject) {
          scopes.push(parent._scope);
          parent = parent._super;
        }
      }

      for (var i = 0, len = scopes.length; i < len; i++) {
        if (scopes[i].hasOwnProperty(name)) {
          return true;
        }
      }

      return false;
    ;
    };

    def.$const_get = function(name, inherit) {
      var $a;if (inherit == null) {
        inherit = true
      }
      if (($a = name['$=~'](/^[A-Z]\w+$/)) === false || $a === nil) {
        this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "wrong constant name " + (name))
      };

      var scopes = [this._scope];
      if (inherit || this == Opal.Object) {
        var parent = this._super;
        while (parent !== Opal.BasicObject) {
          scopes.push(parent._scope);
          parent = parent._super;
        }
      }

      for (var i = 0, len = scopes.length; i < len; i++) {
        if (scopes[i].hasOwnProperty(name)) {
          return scopes[i][name];
        }
       }

      return this.$const_missing(name);
    ;
    };

    def.$const_missing = function(const$) {
      var $a, name = nil;
      name = this._name;
      return this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "uninitialized constant " + (name) + "::" + (const$));
    };

    def.$const_set = function(name, value) {
      var $a;
      if (($a = name['$=~'](/^[A-Z]\w+$/)) === false || $a === nil) {
        this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "wrong constant name " + (name))
      };
      try {
        name = name.$to_str()
      } catch ($err) {
      if (true){
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "conversion with #to_str failed")}else { throw $err; }
      };

      this._scope[name] = value;

      if (value._isClass && value._name === nil) {
        value._name = this.$name() + '::' + name;
      }

      return value
    ;
    };

    def.$define_method = TMP_2 = function(name, method) {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;

      if (method) {
        block = method;
      }

      if (block === nil) {
        throw new Error("no block given");
      }

      var jsid    = '$' + name;
      block._jsid = jsid;
      block._sup  = this._proto[jsid];
      block._s    = null;

      this._proto[jsid] = block;
      $opal.donate(this, [jsid]);

      return null;

    };

    def.$include = function(mods) {
      mods = $slice.call(arguments, 0);

      var i = mods.length - 1, mod;
      while (i >= 0) {
        mod = mods[i];
        i--;

        if (mod === this) {
          continue;
        }

        (mod).$append_features(this);
        (mod).$included(this);
      }

      return this;

    };

    def.$instance_methods = function(include_super) {
      if (include_super == null) {
        include_super = false
      }

      var methods = [], proto = this._proto;

      for (var prop in this._proto) {
        if (!include_super && !proto.hasOwnProperty(prop)) {
          continue;
        }

        if (prop.charAt(0) === '$') {
          methods.push(prop.substr(1));
        }
      }

      return methods;
    ;
    };

    def.$included = function(mod) {

      return nil;
    };

    def.$module_eval = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;

      if (block === nil) {
        throw new Error("no block given");
      }

      var block_self = block._s, result;

      block._s = null;
      result = block.call(this);
      block._s = block_self;

      return result;

    };

    def.$class_eval = def.$module_eval;

    def['$method_defined?'] = function(method) {


      var body = this._proto['$' + method];
      return (!!body) && !body.rb_stub;
    ;
    };

    def.$module_function = function(methods) {
      methods = $slice.call(arguments, 0);

      for (var i = 0, length = methods.length; i < length; i++) {
        var meth = methods[i], func = this._proto['$' + meth];

        this.constructor.prototype['$' + meth] = func;
      }

      return this;

    };

    def.$name = function() {

      return this._name;
    };

    def.$public = function() {

      return nil;
    };

    def.$private = def.$public;

    def.$protected = def.$public;

    def['$public_method_defined?'] = def['$method_defined?'];

    def.$remove_const = function(name) {


      var old = this._scope[name];
      delete this._scope[name];
      return old;
    ;
    };

    def.$to_s = function() {

      return this._name;
    };

    def.$undef_method = function(symbol) {

      $opal.add_stub_for(this._proto, "$" + symbol);
      return this;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/module.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$allocate']);
  return (function($base, $super){
    function Class() {};
    Class = $klass($base, $super, "Class", Class);

    var def = Class._proto, $scope = Class._scope, TMP_1, TMP_2;

    Class.constructor.prototype['$new'] = TMP_1 = function(sup) {
      var $a, $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;if (sup == null) {
        sup = (($a = $scope.Object) == null ? $opal.cm("Object") : $a)
      }

      function AnonClass(){};
      var klass   = Opal.boot(sup, AnonClass)
      klass._name = nil;
      klass._scope = sup._scope;

      sup.$inherited(klass);

      if (block !== nil) {
        var block_self = block._s;
        block._s = null;
        block.call(klass);
        block._s = block_self;
      }

      return klass;

    };

    def.$allocate = function() {


      var obj = new this._alloc;
      obj._id = Opal.uid();
      return obj;
    ;
    };

    def.$inherited = function(cls) {

      return nil;
    };

    def.$new = TMP_2 = function(args) {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;args = $slice.call(arguments, 0);

      var obj = this.$allocate();
      obj._id = Opal.uid();

      obj.$initialize._p = block;
      obj.$initialize.apply(obj, args);
      return obj;
    ;
    };

    def.$superclass = function() {

      return this._super || nil;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/class.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$raise']);
  return (function($base, $super){
    function BasicObject() {};
    BasicObject = $klass($base, $super, "BasicObject", BasicObject);

    var def = BasicObject._proto, $scope = BasicObject._scope, TMP_1, TMP_2, TMP_3, TMP_4;

    def.$initialize = function() {

      return nil;
    };

    def['$=='] = function(other) {

      return this === other;
    };

    def.$__send__ = TMP_1 = function(symbol, args) {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;args = $slice.call(arguments, 1);

      var func = this['$' + symbol]

      if (func) {
        if (block !== nil) { func._p = block; }
        return func.apply(this, args);
      }

      if (block !== nil) { this.$method_missing._p = block; }
      return this.$method_missing.apply(this, [symbol].concat(args));
    ;
    };

    def['$eql?'] = def['$=='];

    def['$equal?'] = def['$=='];

    def.$instance_eval = TMP_2 = function() {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;

      if (block === nil) {
        throw new Error("no block given");
      }

      var block_self = block._s, result;

      block._s = null;
      result = block.call(this, this);
      block._s = block_self;

      return result;
    ;
    };

    def.$instance_exec = TMP_3 = function(args) {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;args = $slice.call(arguments, 0);

      if (block === nil) {
        throw new Error("no block given");
      }

      var block_self = block._s, result;

      block._s = null;
      result = block.apply(this, args);
      block._s = block_self;

      return result;

    };

    def.$method_missing = TMP_4 = function(symbol, args) {
      var $a, $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;args = $slice.call(arguments, 1);
      return (($a = $scope.Kernel) == null ? $opal.cm("Kernel") : $a).$raise((($a = $scope.NoMethodError) == null ? $opal.cm("NoMethodError") : $a), "undefined method `" + (symbol) + "' for BasicObject instance");
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/basic_object.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $gvars = $opal.gvars;

  $opal.add_stubs(['$raise', '$inspect', '$native?', '$respond_to?', '$to_ary', '$to_a', '$allocate', '$class', '$new', '$include', '$singleton_class', '$to_i', '$to_s', '$to_f', '$*', '$>', '$length', '$shift', '$print', '$format', '$puts', '$each', '$<=', '$[]', '$is_a?', '$rand']);
  return (function($base){
    function Kernel() {};
    Kernel = $module($base, "Kernel", Kernel);
    var def = Kernel._proto, $scope = Kernel._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_7;

    def.$initialize = def.$initialize;

    def['$=='] = def['$=='];

    def.$__send__ = def.$__send__;

    def['$eql?'] = def['$eql?'];

    def['$equal?'] = def['$equal?'];

    def.$instance_eval = def.$instance_eval;

    def.$instance_exec = def.$instance_exec;

    def.$method_missing = TMP_1 = function(symbol, args) {
      var $a, $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;args = $slice.call(arguments, 1);
      return this.$raise((($a = $scope.NoMethodError) == null ? $opal.cm("NoMethodError") : $a), "undefined method `" + (symbol) + "' for " + (this.$inspect()));
    };

    def['$=~'] = function(obj) {

      return false;
    };

    def['$==='] = function(other) {

      return this == other;
    };

    def.$method = function(name) {
      var $a;

      var recv = this,
          meth = recv['$' + name],
          func = function() {
            return meth.apply(recv, $slice.call(arguments, 0));
          };

      if (!meth) {
        this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a));
      }

      func._klass = (($a = $scope.Method) == null ? $opal.cm("Method") : $a);
      return func;
    ;
    };

    def.$methods = function(all) {
      if (all == null) {
        all = true
      }

      var methods = [];
      for(var k in this) {
        if(k[0] == "$" && typeof (this)[k] === "function") {
          if(all === false || all === nil) {
            if(!Object.hasOwnProperty.call(this, k)) {
              continue;
            }
          }
          methods.push(k.substr(1));
        }
      }
      return methods;
    ;
    };

    def.$Array = function(object, func, length) {
      if (length == null) {
        length = "length"
      }

      if (object == null || object === nil) {
        return [];
      }
      else if (this['$native?'](object) && object[length] != null) {
        var result = [];

        for (var i = 0, length = object[length]; i < length; i++) {
          result.push(func ? object[func](i) : object[i]);
        }

        return result;
      }
      else if (object['$respond_to?']("to_ary")) {
        return object.$to_ary();
      }
      else if (object['$respond_to?']("to_a")) {
        return object.$to_a();
      }
      else {
        return [object];
      }
    ;
    };

    def.$class = function() {

      return this._klass;
    };

    def.$define_singleton_method = TMP_2 = function(name) {
      var $iter = TMP_2._p, body = $iter || nil;TMP_2._p = null;

      if (body === nil) {
        throw new Error("no block given");
      }

      var jsid   = '$' + name;
      body._jsid = jsid;
      body._sup  = this[jsid];
      body._s    = null;

      this[jsid] = body;

      return this;

    };

    def.$dup = function() {

      return this.$class().$allocate();
    };

    def.$enum_for = function(method, args) {
      var $a, $b;if (method == null) {
        method = "each"
      }args = $slice.call(arguments, 1);
      return ($a = (($b = $scope.Enumerator) == null ? $opal.cm("Enumerator") : $b)).$new.apply($a, [this, method].concat(args));
    };

    def['$equal?'] = function(other) {

      return this === other;
    };

    def.$extend = function(mods) {
      mods = $slice.call(arguments, 0);

      for (var i = 0, length = mods.length; i < length; i++) {
        this.$singleton_class().$include(mods[i]);
      }

      return this;

    };

    def.$format = function(format, args) {
      args = $slice.call(arguments, 1);

      var idx = 0;
      return format.replace(/%(\d+\$)?([-+ 0]*)(\d*|\*(\d+\$)?)(?:\.(\d*|\*(\d+\$)?))?([cspdiubBoxXfgeEG])|(%%)/g, function(str, idx_str, flags, width_str, w_idx_str, prec_str, p_idx_str, spec, escaped) {
        if (escaped) {
          return '%';
        }

        var width,
        prec,
        is_integer_spec = ("diubBoxX".indexOf(spec) != -1),
        is_float_spec = ("eEfgG".indexOf(spec) != -1),
        prefix = '',
        obj;

        if (width_str === undefined) {
          width = undefined;
        } else if (width_str.charAt(0) == '*') {
          var w_idx = idx++;
          if (w_idx_str) {
            w_idx = parseInt(w_idx_str, 10) - 1;
          }
          width = (args[w_idx]).$to_i();
        } else {
          width = parseInt(width_str, 10);
        }
        if (!prec_str) {
          prec = is_float_spec ? 6 : undefined;
        } else if (prec_str.charAt(0) == '*') {
          var p_idx = idx++;
          if (p_idx_str) {
            p_idx = parseInt(p_idx_str, 10) - 1;
          }
          prec = (args[p_idx]).$to_i();
        } else {
          prec = parseInt(prec_str, 10);
        }
        if (idx_str) {
          idx = parseInt(idx_str, 10) - 1;
        }
        switch (spec) {
        case 'c':
          obj = args[idx];
          if (obj._isString) {
            str = obj.charAt(0);
          } else {
            str = String.fromCharCode((obj).$to_i());
          }
          break;
        case 's':
          str = (args[idx]).$to_s();
          if (prec !== undefined) {
            str = str.substr(0, prec);
          }
          break;
        case 'p':
          str = (args[idx]).$inspect();
          if (prec !== undefined) {
            str = str.substr(0, prec);
          }
          break;
        case 'd':
        case 'i':
        case 'u':
          str = (args[idx]).$to_i().toString();
          break;
        case 'b':
        case 'B':
          str = (args[idx]).$to_i().toString(2);
          break;
        case 'o':
          str = (args[idx]).$to_i().toString(8);
          break;
        case 'x':
        case 'X':
          str = (args[idx]).$to_i().toString(16);
          break;
        case 'e':
        case 'E':
          str = (args[idx]).$to_f().toExponential(prec);
          break;
        case 'f':
          str = (args[idx]).$to_f().toFixed(prec);
          break;
        case 'g':
        case 'G':
          str = (args[idx]).$to_f().toPrecision(prec);
          break;
        }
        idx++;
        if (is_integer_spec || is_float_spec) {
          if (str.charAt(0) == '-') {
            prefix = '-';
            str = str.substr(1);
          } else {
            if (flags.indexOf('+') != -1) {
              prefix = '+';
            } else if (flags.indexOf(' ') != -1) {
              prefix = ' ';
            }
          }
        }
        if (is_integer_spec && prec !== undefined) {
          if (str.length < prec) {
            str = "0"['$*'](prec - str.length) + str;
          }
        }
        var total_len = prefix.length + str.length;
        if (width !== undefined && total_len < width) {
          if (flags.indexOf('-') != -1) {
            str = str + " "['$*'](width - total_len);
          } else {
            var pad_char = ' ';
            if (flags.indexOf('0') != -1) {
              str = "0"['$*'](width - total_len) + str;
            } else {
              prefix = " "['$*'](width - total_len) + prefix;
            }
          }
        }
        var result = prefix + str;
        if ('XEG'.indexOf(spec) != -1) {
          result = result.toUpperCase();
        }
        return result;
      });

    };

    def.$hash = function() {

      return this._id;
    };

    def.$inspect = function() {

      return this.$to_s();
    };

    def['$instance_of?'] = function(klass) {

      return this._klass === klass;
    };

    def['$instance_variable_defined?'] = function(name) {

      return this.hasOwnProperty(name.substr(1));
    };

    def.$instance_variable_get = function(name) {


      var ivar = this[name.substr(1)];

      return ivar == null ? nil : ivar;
    ;
    };

    def.$instance_variable_set = function(name, value) {

      return this[name.substr(1)] = value;
    };

    def.$instance_variables = function() {


      var result = [];

      for (var name in this) {
        if (name.charAt(0) !== '$') {
          result.push(name);
        }
      }

      return result;

    };

    def.$Integer = function(str) {

      return parseInt(str);
    };

    def['$is_a?'] = function(klass) {


      var search = this._klass;

      while (search) {
        if (search === klass) {
          return true;
        }

        search = search._super;
      }

      return false;
    ;
    };

    def['$kind_of?'] = def['$is_a?'];

    def.$lambda = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      return block;
    };

    def.$loop = TMP_4 = function() {
      var $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      while (true) {;
      if ($opal.$yieldX(block, []) === $breaker) return $breaker.$v;
      };
      return this;
    };

    def['$nil?'] = function() {

      return false;
    };

    def.$object_id = function() {

      return this._id || (this._id = Opal.uid());
    };

    def.$printf = function(args) {
      var $a, fmt = nil;args = $slice.call(arguments, 0);
      if (args.$length()['$>'](0)) {
        fmt = args.$shift();
        this.$print(($a = this).$format.apply($a, [fmt].concat(args)));
      };
      return nil;
    };

    def.$proc = TMP_5 = function() {
      var $a, $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;

      if (block === nil) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "no block given");
      }
      block.is_lambda = false;
      return block;
    ;
    };

    def.$puts = function(strs) {
      var $a;strs = $slice.call(arguments, 0);
      return ($a = $gvars["stdout"]).$puts.apply($a, [].concat(strs));
    };

    def.$p = function(args) {
      var TMP_6, $a, $b;args = $slice.call(arguments, 0);
      ($a = ($b = args).$each, $a._p = (TMP_6 = function(obj) {

        var self = TMP_6._s || this;
        if (obj == null) obj = nil;

        return $gvars["stdout"].$puts(obj.$inspect())
      }, TMP_6._s = this, TMP_6), $a).call($b);
      if (args.$length()['$<='](1)) {
        return args['$[]'](0)
      } else {
        return args
      };
    };

    def.$print = def.$puts;

    def.$raise = function(exception, string) {
      var $a;if (exception == null) {
        exception = ""
      }

      if (typeof(exception) === 'string') {
        exception = (($a = $scope.RuntimeError) == null ? $opal.cm("RuntimeError") : $a).$new(exception);
      }
      else if (!exception['$is_a?']((($a = $scope.Exception) == null ? $opal.cm("Exception") : $a))) {
        exception = exception.$new(string);
      }

      throw exception;
    ;
    };

    def.$rand = function(max) {


      if(!max) {
        return Math.random();
      } else {
        if (max._isRange) {
          var arr = max.$to_a();
          return arr[this.$rand(arr.length)];
        } else {
          return Math.floor(Math.random() * Math.abs(parseInt(max)));
        }
      }

    };

    def['$respond_to?'] = function(name) {


      var body = this['$' + name];
      return (!!body) && !body.rb_stub;
    ;
    };

    def.$send = def.$__send__;

    def.$public_send = def.$__send__;

    def.$singleton_class = function() {


      if (this._isClass) {
        if (this._singleton) {
          return this._singleton;
        }

        var meta = new $opal.Class._alloc;
        meta._klass = $opal.Class;
        this._singleton = meta;
        // FIXME - is this right? (probably - methods defined on
        // class' singleton should also go to subclasses?)
        meta._proto = this.constructor.prototype;
        meta._isSingleton = true;

        meta._scope = this._scope;

        return meta;
      }

      if (this._isClass) {
        return this._klass;
      }

      if (this._singleton) {
        return this._singleton;
      }

      else {
        var orig_class = this._klass,
            class_id   = "#<Class:#<" + orig_class._name + ":" + orig_class._id + ">>";

        var Singleton = function () {};
        var meta = Opal.boot(orig_class, Singleton);
        meta._name = class_id;

        meta._proto = this;
        this._singleton = meta;
        meta._klass = orig_class._klass;
        meta._scope = orig_class._scope;

        return meta;
      }
    ;
    };

    def.$sprintf = def.$format;

    def.$String = function(str) {

      return String(str);
    };

    def.$tap = TMP_7 = function() {
      var $iter = TMP_7._p, block = $iter || nil;TMP_7._p = null;
      if ($opal.$yield1(block, this) === $breaker) return $breaker.$v;
      return this;
    };

    def.$to_proc = function() {

      return this;
    };

    def.$to_s = function() {

      return "#<" + this._klass._name + ":" + this._id + ">";;
    };

    def.$to_str = def.$to_s;

    def.$freeze = function() {

      this.___frozen___ = true;
      return this;
    };

    def['$frozen?'] = function() {
      var $a;
      if (this.___frozen___ == null) this.___frozen___ = nil;

      return ((($a = this.___frozen___) !== false && $a !== nil) ? $a : false);
    };
    ;$opal.donate(Kernel, ["$initialize", "$==", "$__send__", "$eql?", "$equal?", "$instance_eval", "$instance_exec", "$method_missing", "$=~", "$===", "$method", "$methods", "$Array", "$class", "$define_singleton_method", "$dup", "$enum_for", "$equal?", "$extend", "$format", "$hash", "$inspect", "$instance_of?", "$instance_variable_defined?", "$instance_variable_get", "$instance_variable_set", "$instance_variables", "$Integer", "$is_a?", "$kind_of?", "$lambda", "$loop", "$nil?", "$object_id", "$printf", "$proc", "$puts", "$p", "$print", "$raise", "$rand", "$respond_to?", "$send", "$public_send", "$singleton_class", "$sprintf", "$String", "$tap", "$to_proc", "$to_s", "$to_str", "$freeze", "$frozen?"]);
  })(self)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/kernel.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$raise']);
  return (function($base, $super){
    function NilClass() {};
    NilClass = $klass($base, $super, "NilClass", NilClass);

    var def = NilClass._proto, $scope = NilClass._scope;

    def['$&'] = function(other) {

      return false;
    };

    def['$|'] = function(other) {

      return other !== false && other !== nil;
    };

    def['$^'] = function(other) {

      return other !== false && other !== nil;
    };

    def['$=='] = function(other) {

      return other === nil;
    };

    def.$dup = function() {
      var $a;
      return this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a));
    };

    def.$inspect = function() {

      return "nil";
    };

    def['$nil?'] = function() {

      return true;
    };

    def.$singleton_class = function() {
      var $a;
      return (($a = $scope.NilClass) == null ? $opal.cm("NilClass") : $a);
    };

    def.$to_a = function() {

      return [];
    };

    def.$to_h = function() {

      return $opal.hash();
    };

    def.$to_i = function() {

      return 0;
    };

    def.$to_f = def.$to_i;

    def.$to_n = function() {

      return null;
    };

    def.$to_s = function() {

      return "";
    };

    def.$object_id = function() {
      var $a;
      return (($a = $scope.NilClass) == null ? $opal.cm("NilClass") : $a)._id || ((($a = $scope.NilClass) == null ? $opal.cm("NilClass") : $a)._id = $opal.uid());
    };

    return def.$hash = def.$object_id;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/nil_class.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs([]);
  (function($base, $super){
    function Boolean() {};
    Boolean = $klass($base, $super, "Boolean", Boolean);

    var def = Boolean._proto, $scope = Boolean._scope;

    def._isBoolean = true;

    def['$&'] = function(other) {

      return (this == true) ? (other !== false && other !== nil) : false;
    };

    def['$|'] = function(other) {

      return (this == true) ? true : (other !== false && other !== nil);
    };

    def['$^'] = function(other) {

      return (this == true) ? (other === false || other === nil) : (other !== false && other !== nil);
    };

    def['$=='] = function(other) {

      return (this == true) === other.valueOf();
    };

    def.$singleton_class = def.$class;

    def.$to_s = function() {

      return (this == true) ? 'true' : 'false';
    };

    def.$to_n = function() {

      return this.valueOf();
    };

    return nil;
  })(self, null);
  $scope.TrueClass = (($a = $scope.Boolean) == null ? $opal.cm("Boolean") : $a);
  return $scope.FalseClass = (($a = $scope.Boolean) == null ? $opal.cm("Boolean") : $a);
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/boolean.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$attr_reader', '$name', '$class']);
  (function($base, $super){
    function Exception() {};
    Exception = $klass($base, $super, "Exception", Exception);

    var def = Exception._proto, $scope = Exception._scope;
    def.message = nil;

    Exception.$attr_reader("message");

    Exception.constructor.prototype['$new'] = function(message) {
      if (message == null) {
        message = ""
      }

      var err = new Error(message);
      err._klass = this;
      err.name = this._name;
      return err;

    };

    def.$backtrace = function() {


      var backtrace = this.stack;

      if (typeof(backtrace) === 'string') {
        return backtrace.split("\n").slice(0, 15);
      }
      else if (backtrace) {
        return backtrace.slice(0, 15);
      }

      return [];
    ;
    };

    def.$inspect = function() {

      return "#<" + (this.$class().$name()) + ": '" + (this.message) + "'>";
    };

    return def.$to_s = def.$message;
  })(self, null);
  (function($base, $super){
    function StandardError() {};
    StandardError = $klass($base, $super, "StandardError", StandardError);

    var def = StandardError._proto, $scope = StandardError._scope;

    return nil
  })(self, (($a = $scope.Exception) == null ? $opal.cm("Exception") : $a));
  (function($base, $super){
    function NameError() {};
    NameError = $klass($base, $super, "NameError", NameError);

    var def = NameError._proto, $scope = NameError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function NoMethodError() {};
    NoMethodError = $klass($base, $super, "NoMethodError", NoMethodError);

    var def = NoMethodError._proto, $scope = NoMethodError._scope;

    return nil
  })(self, (($a = $scope.NameError) == null ? $opal.cm("NameError") : $a));
  (function($base, $super){
    function RuntimeError() {};
    RuntimeError = $klass($base, $super, "RuntimeError", RuntimeError);

    var def = RuntimeError._proto, $scope = RuntimeError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function LocalJumpError() {};
    LocalJumpError = $klass($base, $super, "LocalJumpError", LocalJumpError);

    var def = LocalJumpError._proto, $scope = LocalJumpError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function TypeError() {};
    TypeError = $klass($base, $super, "TypeError", TypeError);

    var def = TypeError._proto, $scope = TypeError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function ArgumentError() {};
    ArgumentError = $klass($base, $super, "ArgumentError", ArgumentError);

    var def = ArgumentError._proto, $scope = ArgumentError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function IndexError() {};
    IndexError = $klass($base, $super, "IndexError", IndexError);

    var def = IndexError._proto, $scope = IndexError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function StopIteration() {};
    StopIteration = $klass($base, $super, "StopIteration", StopIteration);

    var def = StopIteration._proto, $scope = StopIteration._scope;

    return nil
  })(self, (($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a));
  (function($base, $super){
    function KeyError() {};
    KeyError = $klass($base, $super, "KeyError", KeyError);

    var def = KeyError._proto, $scope = KeyError._scope;

    return nil
  })(self, (($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a));
  (function($base, $super){
    function RangeError() {};
    RangeError = $klass($base, $super, "RangeError", RangeError);

    var def = RangeError._proto, $scope = RangeError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function IOError() {};
    IOError = $klass($base, $super, "IOError", IOError);

    var def = IOError._proto, $scope = IOError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function ScriptError() {};
    ScriptError = $klass($base, $super, "ScriptError", ScriptError);

    var def = ScriptError._proto, $scope = ScriptError._scope;

    return nil
  })(self, (($a = $scope.Exception) == null ? $opal.cm("Exception") : $a));
  (function($base, $super){
    function SyntaxError() {};
    SyntaxError = $klass($base, $super, "SyntaxError", SyntaxError);

    var def = SyntaxError._proto, $scope = SyntaxError._scope;

    return nil
  })(self, (($a = $scope.ScriptError) == null ? $opal.cm("ScriptError") : $a));
  (function($base, $super){
    function NotImplementedError() {};
    NotImplementedError = $klass($base, $super, "NotImplementedError", NotImplementedError);

    var def = NotImplementedError._proto, $scope = NotImplementedError._scope;

    return nil
  })(self, (($a = $scope.ScriptError) == null ? $opal.cm("ScriptError") : $a));
  return (function($base, $super){
    function SystemExit() {};
    SystemExit = $klass($base, $super, "SystemExit", SystemExit);

    var def = SystemExit._proto, $scope = SystemExit._scope;

    return nil
  })(self, (($a = $scope.Exception) == null ? $opal.cm("Exception") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/error.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, $gvars = $opal.gvars;

  $opal.add_stubs(['$new']);
  return (function($base, $super){
    function Regexp() {};
    Regexp = $klass($base, $super, "Regexp", Regexp);

    var def = Regexp._proto, $scope = Regexp._scope;

    def._isRegexp = true;

    Regexp.constructor.prototype['$escape'] = function(string) {

      return string.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\^\$\|]/g, '\\$&');
    };

    Regexp.constructor.prototype['$new'] = function(regexp, options) {

      return options? new RegExp(regexp, options) : new RegExp(regexp);
    };

    def['$=='] = function(other) {

      return other.constructor == RegExp && this.toString() === other.toString();
    };

    def['$==='] = function(str) {

      return this.test(str);
    };

    def['$=~'] = function(string) {
      var $a;

      var re = this;
      if (re.global) {
        // should we clear it afterwards too?
        re.lastIndex = 0;
      }
      else {
        // rewrite regular expression to add the global flag to capture pre/post match
        re = new RegExp(re.source, 'g' + (re.multiline ? 'm' : '') + (re.ignoreCase ? 'i' : ''));
      }

      var result = re.exec(string);

      if (result) {
        $gvars["~"] = (($a = $scope.MatchData) == null ? $opal.cm("MatchData") : $a).$new(re, result);
      }
      else {
        $gvars["~"] = $gvars["`"] = $gvars["'"] = nil;
      }

      return result ? result.index : nil;
    ;
    };

    def['$eql?'] = def['$=='];

    def.$inspect = function() {

      return this.toString();
    };

    def.$match = function(string, pos) {
      var $a;

      var re = this;
      if (re.global) {
        // should we clear it afterwards too?
        re.lastIndex = 0;
      }
      else {
        re = new RegExp(re.source, 'g' + (this.multiline ? 'm' : '') + (this.ignoreCase ? 'i' : ''));
      }

      var result = re.exec(string);

      if (result) {
        return $gvars["~"] = (($a = $scope.MatchData) == null ? $opal.cm("MatchData") : $a).$new(re, result);
      }
      else {
        return $gvars["~"] = $gvars["`"] = $gvars["'"] = nil;
      }
    ;
    };

    def.$source = function() {

      return this.source;
    };

    def.$to_s = def.$source;

    def.$to_n = function() {

      return this.valueOf();
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/regexp.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module;

  $opal.add_stubs(['$==', '$<=>', '$<=', '$>=', '$>', '$<']);
  return (function($base){
    function Comparable() {};
    Comparable = $module($base, "Comparable", Comparable);
    var def = Comparable._proto, $scope = Comparable._scope;

    def['$<'] = function(other) {

      return this['$<=>'](other)['$=='](-1);
    };

    def['$<='] = function(other) {

      return this['$<=>'](other)['$<='](0);
    };

    def['$=='] = function(other) {

      return this['$<=>'](other)['$=='](0);
    };

    def['$>'] = function(other) {

      return this['$<=>'](other)['$=='](1);
    };

    def['$>='] = function(other) {

      return this['$<=>'](other)['$>='](0);
    };

    def['$between?'] = function(min, max) {
      var $a;
      return (($a = this['$>'](min)) ? this['$<'](max) : $a);
    };
    ;$opal.donate(Comparable, ["$<", "$<=", "$==", "$>", "$>=", "$between?"]);
  })(self)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/comparable.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module;

  $opal.add_stubs(['$enum_for', '$==', '$call', '$===', '$[]=', '$new', '$<<', '$[]', '$each', '$>', '$raise', '$<', '$map', '$sort']);
  return (function($base){
    function Enumerable() {};
    Enumerable = $module($base, "Enumerable", Enumerable);
    var def = Enumerable._proto, $scope = Enumerable._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12, TMP_13, TMP_14, TMP_17, TMP_18, TMP_19, TMP_20;

    def['$all?'] = TMP_1 = function() {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;

      var result = true, proc;

      if (block !== nil) {
        proc = function(obj) {
          var value;
          var args = $slice.call(arguments);

          if ((value = block.apply(this, args)) === $breaker) {
            return $breaker.$v;
          }

          if (value === false || value === nil) {
            result = false;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }
      else {
        proc = function(obj) {
          if ((obj === false || obj === nil) && arguments.length < 2) {
            result       = false;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def['$any?'] = TMP_2 = function() {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;

      var result = false, proc;

      if (block !== nil) {
        proc = function(obj) {
          var value;
          var args = $slice.call(arguments);

          if ((value = block.apply(this, args)) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            result       = true;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }
      else {
        proc = function(obj) {
          if ((obj !== false && obj !== nil) || arguments.length >= 2) {
            result      = true;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$collect = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      if (block === nil) {
        return this.$enum_for("collect")
      };

      var result = [];

      var proc = function() {
        var value, args = $slice.call(arguments);

        if ((value = block.apply(null, arguments)) === $breaker) {
          return $breaker.$v;
        }

        result.push(value);
      };

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$reduce = TMP_4 = function(object) {
      var $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;

      var result = object == undefined ? 0 : object;

      var proc = function() {
        var obj = $slice.call(arguments), value;

        if ((value = block.apply(nil, [result].concat(obj))) === $breaker) {
          result = $breaker.$v;
          $breaker.$v = nil;

          return $breaker;
        }

        result = value;
      };

      this.$each._p = proc;
      this.$each();

      return result;
    ;
    };

    def.$count = TMP_5 = function(object) {
      var $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;

      var result = 0;

      if (object != null) {
        block = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          return (param)['$=='](object);
        };
      }
      else if (block === nil) {
        block = function() { return true; };
      }

      var proc = function() {
        var value, param = $slice.call(arguments);

        if ((value = block.apply(null, param)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          result++;
        }
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$detect = TMP_6 = function(ifnone) {
      var $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;

      var result = nil;

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          result       = param;
          $breaker.$v = nil;

          return $breaker;
        }
      };

      this.$each();

      if (result !== nil) {
        return result;
      }

      if (typeof(ifnone) === 'function') {
        return ifnone.$call();
      }

      return ifnone == null ? nil : ifnone;

    };

    def.$drop = function(number) {


      var result  = [],
          current = 0;

      this.$each._p = function() {
        if (number < current) {
          result.push(e);
        }

        current++;
      };

      this.$each()

      return result;

    };

    def.$drop_while = TMP_7 = function() {
      var $iter = TMP_7._p, block = $iter || nil;TMP_7._p = null;

      var result = [];

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param)) === $breaker) {
          return $breaker;
        }

        if (value === false || value === nil) {
          result.push(param);
          return value;
        }

        return $breaker;
      };

      this.$each();

      return result;

    };

    def.$each_slice = TMP_8 = function(n) {
      var $iter = TMP_8._p, block = $iter || nil;TMP_8._p = null;

      var all = [];

      this.$each._p = function() {
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        all.push(param);

        if (all.length == n) {
          block(all.slice(0));
          all = [];
        }
      };

      this.$each();

      // our "last" group, if smaller than n then wont have been yielded
      if (all.length > 0) {
        block(all.slice(0));
      }

      return nil;

    };

    def.$each_with_index = TMP_9 = function() {
      var $iter = TMP_9._p, block = $iter || nil;TMP_9._p = null;

      var index = 0;

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param, index)) === $breaker) {
          return $breaker.$v;
        }

        index++;
      };
      this.$each();

      return nil;

    };

    def.$each_with_object = TMP_10 = function(object) {
      var $iter = TMP_10._p, block = $iter || nil;TMP_10._p = null;

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param, object)) === $breaker) {
          return $breaker.$v;
        }
      };

      this.$each();

      return object;
    ;
    };

    def.$entries = function() {


      var result = [];

      this.$each._p = function() {
        if (arguments.length == 1) {
          result.push(arguments[0]);
        }
        else {
          result.push($slice.call(arguments));
        }
      };

      this.$each();

      return result;

    };

    def.$find = def.$detect;

    def.$find_all = TMP_11 = function() {
      var $iter = TMP_11._p, block = $iter || nil;TMP_11._p = null;

      var result = [];

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          result.push(param);
        }
      };

      this.$each();

      return result;

    };

    def.$find_index = TMP_12 = function(object) {
      var $iter = TMP_12._p, block = $iter || nil;TMP_12._p = null;

      var proc, result = nil, index = 0;

      if (object != null) {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          if ((param)['$=='](object)) {
            result = index;
            return $breaker;
          }

          index += 1;
        };
      }
      else {
        proc = function() {
          var value;
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          if ((value = block(param)) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            result       = index;
            $breaker.$v = index;

            return $breaker;
          }

          index += 1;
        };
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$first = function(number) {


      var result  = [],
          current = 0,
          proc;

      if (number == null) {
        result = nil;
        proc   = function() {
          result = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          return $breaker;
        };
      }
      else {
        proc = function() {
          if (number <= current) {
            return $breaker;
          }

          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          result.push(param);

          current++;
        };
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$grep = TMP_13 = function(pattern) {
      var $iter = TMP_13._p, block = $iter || nil;TMP_13._p = null;

      var result = [],
          proc;

      if (block !== nil) {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          var value = pattern['$==='](param);

          if (value !== false && value !== nil) {
            if ((value = block(param)) === $breaker) {
              return $breaker.$v;
            }

            result.push(value);
          }
        };
      }
      else {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          var value = pattern['$==='](param);

          if (value !== false && value !== nil) {
            result.push(param);
          }
        };
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$group_by = TMP_14 = function() {
      var TMP_15, $a, $b, $c, TMP_16, $iter = TMP_14._p, block = $iter || nil, hash = nil;TMP_14._p = null;
      hash = ($a = ($b = (($c = $scope.Hash) == null ? $opal.cm("Hash") : $c)).$new, $a._p = (TMP_15 = function(h, k) {

        var self = TMP_15._s || this;
        if (h == null) h = nil;
if (k == null) k = nil;

        return h['$[]='](k, [])
      }, TMP_15._s = this, TMP_15), $a).call($b);
      ($a = ($c = this).$each, $a._p = (TMP_16 = function(el) {

        var self = TMP_16._s || this;
        if (el == null) el = nil;

        return hash['$[]'](block.$call(el))['$<<'](el)
      }, TMP_16._s = this, TMP_16), $a).call($c);
      return hash;
    };

    def.$map = def.$collect;

    def.$max = TMP_17 = function() {
      var $a, $iter = TMP_17._p, block = $iter || nil;TMP_17._p = null;

      var proc, result;
      var arg_error = false;

      if (block !== nil) {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          if (result == undefined) {
            result = param;
          }
          else if ((value = block(param, result)) === $breaker) {
            result = $breaker.$v;

            return $breaker;
          }
          else {
            if (value > 0) {
              result = param;
            }

            $breaker.$v = nil;
          }
        }
      }
      else {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          var modules = param.$class().$included_modules;

          if (modules == undefined || modules.length == 0 || modules.indexOf(Opal.Comparable) == -1) {
            arg_error = true;

            return $breaker;
          }

          if (result == undefined || (param)['$>'](result)) {
            result = param;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      if (arg_error) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "Array#max");
      }

      return (result == undefined ? nil : result);

    };

    def.$min = TMP_18 = function() {
      var $a, $iter = TMP_18._p, block = $iter || nil;TMP_18._p = null;

      var proc,
          result,
          arg_error = false;

      if (block !== nil) {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          if (result == undefined) {
            result = param;
          }
          else if ((value = block(param, result)) === $breaker) {
            result = $breaker.$v;

            return $breaker;
          }
          else {
            if (value < 0) {
              result = param;
            }

            $breaker.$v = nil;
          }
        }
      }
      else {
        proc = function(obj) {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          var modules = param.$class().$included_modules;

          if (modules == undefined || modules.length == 0 || modules.indexOf(Opal.Comparable) == -1) {
            arg_error = true;

            return $breaker;
          }

          if (result == undefined || (param)['$<'](result)) {
            result = param;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      if (arg_error) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "Array#min");
      }

      return result == undefined ? nil : result;

    };

    def['$none?'] = TMP_19 = function() {
      var $iter = TMP_19._p, block = $iter || nil;TMP_19._p = null;

      var result = true,
          proc;

      if (block !== nil) {
        proc = function(obj) {
          var value,
              args = $slice.call(arguments);

          if ((value = block.apply(this, args)) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            result       = false;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }
      else {
        proc = function(obj) {
          if (arguments.length == 1 && (obj !== false && obj !== nil)) {
            result       = false;
            $breaker.$v = nil;

            return $breaker;
          }
          else {
            for (var i = 0, length = arguments.length; i < length; i++) {
              if (arguments[i] !== false && arguments[i] !== nil) {
                result       = false;
                $breaker.$v = nil;

                return $breaker;
              }
            }
          }
        };
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    def.$sort_by = TMP_20 = function() {
      var TMP_21, $a, $b, TMP_22, $c, $d, $iter = TMP_20._p, block = $iter || nil;TMP_20._p = null;
      return ($a = ($b = ($c = ($d = this).$map, $c._p = (TMP_22 = function(f) {

        var self = TMP_22._s || this;
        f = $slice.call(arguments, 0);
        f = f.length === 1 ? f[0] : f;
        return [block.$call(f), f];
      }, TMP_22._s = this, TMP_22), $c).call($d).$sort()).$map, $a._p = (TMP_21 = function(f) {

        var self = TMP_21._s || this;
        if (f == null) f = nil;

        return f[1];
      }, TMP_21._s = this, TMP_21), $a).call($b);
    };

    def.$select = def.$find_all;

    def.$take = def.$first;

    def.$to_a = def.$entries;

    def.$inject = def.$reduce;
    ;$opal.donate(Enumerable, ["$all?", "$any?", "$collect", "$reduce", "$count", "$detect", "$drop", "$drop_while", "$each_slice", "$each_with_index", "$each_with_object", "$entries", "$find", "$find_all", "$find_index", "$first", "$grep", "$group_by", "$map", "$max", "$min", "$none?", "$sort_by", "$select", "$take", "$to_a", "$inject"]);
  })(self)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/enumerable.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$enum_for', '$call', '$__send__', '$to_a', '$empty?', '$raise', '$shift']);
  return (function($base, $super){
    function Enumerator() {};
    Enumerator = $klass($base, $super, "Enumerator", Enumerator);

    var def = Enumerator._proto, $scope = Enumerator._scope, $a, TMP_1;
    def.object = def.method = def.args = def.cache = nil;

    Enumerator.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));

    def.$initialize = function(obj, method, args) {
      if (method == null) {
        method = "each"
      }args = $slice.call(arguments, 2);
      this.object = obj;
      this.method = method;
      return this.args = args;
    };

    def.$each = TMP_1 = function() {
      var TMP_2, $a, $b, $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;
      if (block === nil) {
        return this.$enum_for("each")
      };
      return ($a = ($b = this.object).$__send__, $a._p = (TMP_2 = function(e) {

        var self = TMP_2._s || this, $a;
        e = $slice.call(arguments, 0);
        return ($a = block).$call.apply($a, [].concat(e))
      }, TMP_2._s = this, TMP_2), $a).apply($b, [this.method].concat(this.args));
    };

    def.$next = function() {
      var $a;
      ((($a = this.cache) !== false && $a !== nil) ? $a : this.cache = this.$to_a());
      if (($a = this.cache['$empty?']()) !== false && $a !== nil) {
        this.$raise((($a = $scope.StopIteration) == null ? $opal.cm("StopIteration") : $a), "end of enumeration")
      };
      return this.cache.$shift();
    };

    def.$rewind = function() {

      this.cache = nil;
      return this;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/enumerator.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$new', '$class', '$raise', '$respond_to?', '$hash', '$<=>', '$==', '$enum_for', '$flatten', '$replace', '$object_id', '$[]', '$inspect', '$to_s', '$delete_if', '$to_proc', '$each', '$reverse', '$keep_if', '$to_n']);
  return (function($base, $super){
    function Array() {};
    Array = $klass($base, $super, "Array", Array);

    var def = Array._proto, $scope = Array._scope, $a, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12, TMP_13, TMP_14, TMP_15, TMP_16, TMP_17, TMP_18, TMP_19, TMP_20;

    Array.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));

    def._isArray = true;

    Array.constructor.prototype['$[]'] = function(objects) {
      objects = $slice.call(arguments, 0);
      return objects
    };

    def.$initialize = function(args) {
      var $a;args = $slice.call(arguments, 0);
      return ($a = this.$class()).$new.apply($a, [].concat(args));
    };

    Array.constructor.prototype['$new'] = TMP_1 = function(size, obj) {
      var $a, $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;if (obj == null) {
        obj = nil
      }


      if (arguments.length > 2)
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a).$new("wrong number of arguments. Array#new"));

      if (arguments.length == 0)
        return [];

      var size,
          obj = arguments[1],
          arr = [];

      if (!obj) {
        if (size['$respond_to?']("to_ary")) {
          if (size['$is_a?'](Array))
            return size;
          return size['$to_ary']();
        }
      }

      if (typeof(arguments[0]) == 'number')
        size = arguments[0];
      else {
        if ((arguments[0])['$respond_to?']("to_int")) {
          size = arguments[0]['$to_int']();
          if (typeof(size) == 'number') {
            if (size % 1 !== 0) {
              this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Integer. Array#new"));
            }
          } else {
            this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Integer. Array#new"));
          }
        } else {
          this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Integer. Array#new"));
        }
      }

      if (size < 0) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a).$new("negative array size"));
      }

      if (obj == undefined) {
        obj = nil;
      }


      if (block === nil)
        for (var i = 0; i < size; i++) {
          arr.push(obj);
        }
      else {
        for (var i = 0, value; i < size; i++) {
          value = block(i);
          if (value === $breaker) {
            return $breaker.$v;
          }
          arr[i] = block(i);
        }
      }

      return arr;
    ;
    };

    Array.constructor.prototype['$try_convert'] = function(obj) {


      if (obj._isArray) {
        return obj;
      }

      return nil;

    };

    def['$&'] = function(other) {


      var result = [],
          seen   = {};

      for (var i = 0, length = this.length; i < length; i++) {
        var item = this[i];
        if (item._isString) {
          item = item.toString();
        }

        if (!seen[item]) {
          for (var j = 0, length2 = other.length; j < length2; j++) {
            var item2 = other[j];
            if (item2._isString) {
              item2 = item2.toString();
            }

            if (item === item2 && !seen[item]) {
              seen[item] = true;

              result.push(item);
            }
          }
        }
      }

      return result;

    };

    def['$*'] = function(other) {


      if (typeof(other) === 'string') {
        return this.join(other);
      }

      var result = [];

      for (var i = 0; i < other; i++) {
        result = result.concat(this);
      }

      return result;
    ;
    };

    def['$+'] = function(other) {
      var $a;

      var arr = other;

      if (!other._isArray){
        if (other['$respond_to?']("to_ary")) {
          arr = other['$to_ary']();
        }
        else {
          this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Array. Array#+"));
        }
      }

      return this.concat(arr);

    };

    def['$-'] = function(other) {
      var $a;

      var a = this,
          b = other,
          tmp = [],
          result = [];

     if (typeof(b) == "object" && !(b._isArray))  {
        if (other['$respond_to?']("to_ary")) {
          b = b['$to_ary']();
        } else {
          this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Array. Array#-"));
        }
      }else if ((typeof(b) != "object")) {
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Array. Array#-"));
      }

      if (a.length == 0)
        return [];
      if (b.length == 0)
        return a;

      for(var i = 0, length = b.length; i < length; i++) {
        tmp[b[i]] = true;
      }
      for(var i = 0, length = a.length; i < length; i++) {
        if (!tmp[a[i]]) {
          result.push(a[i]);
        }
     }

      return result;
    ;
    };

    def['$<<'] = function(object) {

      this.push(object);;
      return this;
    };

    def['$<=>'] = function(other) {


      if (this.$hash() === other.$hash()) {
        return 0;
      }

      if (this.length != other.length) {
        return (this.length > other.length) ? 1 : -1;
      }

      for (var i = 0, length = this.length, tmp; i < length; i++) {
        if ((tmp = (this[i])['$<=>'](other[i])) !== 0) {
          return tmp;
        }
      }

      return 0;
    ;
    };

    def['$=='] = function(other) {


      if (!other || (this.length !== other.length)) {
        return false;
      }

      for (var i = 0, length = this.length, tmp1, tmp2; i < length; i++) {
        tmp1 = this[i];
        tmp2 = other[i];

        if (tmp1._isArray && tmp2._isArray && (tmp1 === this)) {
          continue;
        }

        if (!((tmp1)['$=='](tmp2))) {
          return false;
        }

      }


      return true;
    ;
    };

    def['$[]'] = function(index, length) {


      var size = this.length;

      if (typeof index !== 'number' && !index._isNumber) {
        if (index._isRange) {
          var exclude = index.exclude;
          length      = index.end;
          index       = index.begin;

          if (index > size) {
            return nil;
          }

          if (length < 0) {
            length += size;
          }

          if (!exclude) length += 1;
          return this.slice(index, length);
        }
        else {
          this.$raise("bad arg for Array#[]");
        }
      }

      if (index < 0) {
        index += size;
      }

      if (length !== undefined) {
        if (length < 0 || index > size || index < 0) {
          return nil;
        }

        return this.slice(index, index + length);
      }
      else {
        if (index >= size || index < 0) {
          return nil;
        }

        return this[index];
      }
    ;
    };

    def['$[]='] = function(index, value) {


      var size = this.length;

      if (index < 0) {
        index += size;
      }

      return this[index] = value;
    ;
    };

    def.$assoc = function(object) {


      for (var i = 0, length = this.length, item; i < length; i++) {
        if (item = this[i], item.length && (item[0])['$=='](object)) {
          return item;
        }
      }

      return nil;
    ;
    };

    def.$at = function(index) {


      if (index < 0) {
        index += this.length;
      }

      if (index < 0 || index >= this.length) {
        return nil;
      }

      return this[index];
    ;
    };

    def.$clear = function() {

      this.splice(0, this.length);
      return this;
    };

    def.$clone = function() {

      return this.slice();
    };

    def.$collect = TMP_2 = function() {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;

      var result = [];


      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        result.push(value);
      }

      return result;

    };

    def['$collect!'] = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;

      for (var i = 0, length = this.length, val; i < length; i++) {
        if ((val = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        this[i] = val;
      }
    ;
      return this;
    };

    def.$compact = function() {


      var result = [];

      for (var i = 0, length = this.length, item; i < length; i++) {
        if ((item = this[i]) !== nil) {
          result.push(item);
        }
      }

      return result;

    };

    def['$compact!'] = function() {


      var original = this.length;

      for (var i = 0, length = this.length; i < length; i++) {
        if (this[i] === nil) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this.length === original ? nil : this;
    ;
    };

    def.$concat = function(other) {


      for (var i = 0, length = other.length; i < length; i++) {
        this.push(other[i]);
      }

      return this;
    };

    def.$count = function(object) {


      if (object == null) {
        return this.length;
      }

      var result = 0;

      for (var i = 0, length = this.length; i < length; i++) {
        if ((this[i])['$=='](object)) {
          result++;
        }
      }

      return result;
    ;
    };

    def.$delete = function(object) {


      var original = this.length;

      for (var i = 0, length = original; i < length; i++) {
        if ((this[i])['$=='](object)) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this.length === original ? nil : object;
    ;
    };

    def.$delete_at = function(index) {


      if (index < 0) {
        index += this.length;
      }

      if (index < 0 || index >= this.length) {
        return nil;
      }

      var result = this[index];

      this.splice(index, 1);

      return result;
    ;
    };

    def.$delete_if = TMP_4 = function() {
      var $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;

      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }
    ;
      return this;
    };

    def.$drop = function(number) {

      return this.slice(number);
    };

    def.$dup = def.$clone;

    def.$each = TMP_5 = function() {
      var $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;
      if (block === nil) {
        return this.$enum_for("each")
      };

      if (block.length > 1) {
        for (var i = 0, length = this.length, el; i < length; i++) {
          el = this[i];
          if (!el._isArray) el = [el];

          if (block.apply(null, el) === $breaker) return $breaker.$v;
        }
      } else {
        for (var i = 0, length = this.length; i < length; i++) {
          if (block(this[i]) === $breaker) return $breaker.$v;
        }
      }
    ;
      return this;
    };

    def.$each_index = TMP_6 = function() {
      var $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;
      for (var i = 0, length = this.length; i < length; i++) {;
      if ($opal.$yield1(block, i) === $breaker) return $breaker.$v;
      };
      return this;
    };

    def['$empty?'] = function() {

      return !this.length;
    };

    def.$fetch = TMP_7 = function(index, defaults) {
      var $a, $iter = TMP_7._p, block = $iter || nil;TMP_7._p = null;

      var original = index;

      if (index < 0) {
        index += this.length;
      }

      if (index >= 0 && index < this.length) {
        return this[index];
      }

      if (defaults != null) {
        return defaults;
      }

      if (block !== nil) {
        return block(original);
      }

      this.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a), "Array#fetch");
    ;
    };

    def.$fill = TMP_8 = function(obj) {
      var $iter = TMP_8._p, block = $iter || nil;TMP_8._p = null;

      if (block !== nil) {
        for (var i = 0, length = this.length; i < length; i++) {
          this[i] = block(i);
        }
      }
      else {
        for (var i = 0, length = this.length; i < length; i++) {
          this[i] = obj;
        }
      }
    ;
      return this;
    };

    def.$first = function(count) {


      if (count != null) {
        return this.slice(0, count);
      }

      return this.length === 0 ? nil : this[0];
    ;
    };

    def.$flatten = function(level) {


      var result = [];

      for (var i = 0, length = this.length, item; i < length; i++) {
        item = this[i];

        if (item._isArray) {
          if (level == null) {
            result = result.concat((item).$flatten());
          }
          else if (level === 0) {
            result.push(item);
          }
          else {
            result = result.concat((item).$flatten(level - 1));
          }
        }
        else {
          result.push(item);
        }
      }

      return result;

    };

    def['$flatten!'] = function(level) {


      var size = this.length;
      this.$replace(this.$flatten(level));

      return size === this.length ? nil : this;
    ;
    };

    def.$hash = function() {

      return this._id || (this._id = Opal.uid());
    };

    def['$include?'] = function(member) {


      for (var i = 0, length = this.length; i < length; i++) {
        if ((this[i])['$=='](member)) {
          return true;
        }
      }

      return false;
    ;
    };

    def.$index = TMP_9 = function(object) {
      var $iter = TMP_9._p, block = $iter || nil;TMP_9._p = null;

      if (object != null) {
        for (var i = 0, length = this.length; i < length; i++) {
          if ((this[i])['$=='](object)) {
            return i;
          }
        }
      }
      else if (block !== nil) {
        for (var i = 0, length = this.length, value; i < length; i++) {
          if ((value = block(this[i])) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            return i;
          }
        }
      }

      return nil;
    ;
    };

    def.$insert = function(index, objects) {
      var $a;objects = $slice.call(arguments, 1);

      if (objects.length > 0) {
        if (index < 0) {
          index += this.length + 1;

          if (index < 0) {
            this.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a), "" + (index) + " is out of bounds");
          }
        }
        if (index > this.length) {
          for (var i = this.length; i < index; i++) {
            this.push(nil);
          }
        }

        this.splice.apply(this, [index, 0].concat(objects));
      }
    ;
      return this;
    };

    def.$inspect = function() {


      var i, inspect, el, el_insp, length, object_id;

      inspect = [];
      object_id = this.$object_id();
      length = this.length;

      for (i = 0; i < length; i++) {
        el = this['$[]'](i);

        // Check object_id to ensure it's not the same array get into an infinite loop
        el_insp = (el).$object_id() === object_id ? '[...]' : (el).$inspect();

        inspect.push(el_insp);
      }
      return '[' + inspect.join(', ') + ']';
    ;
    };

    def.$join = function(sep) {
      if (sep == null) {
        sep = ""
      }

      var result = [];

      for (var i = 0, length = this.length; i < length; i++) {
        result.push((this[i]).$to_s());
      }

      return result.join(sep);

    };

    def.$keep_if = TMP_10 = function() {
      var $iter = TMP_10._p, block = $iter || nil;TMP_10._p = null;

      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }
    ;
      return this;
    };

    def.$last = function(count) {
      var $a;

      var length = this.length;

      if (count === nil || typeof(count) == 'string') {
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "no implicit conversion to integer");
      }

      if (typeof(count) == 'object') {
        if (count['$respond_to?']("to_int")) {
          count = count['$to_int']();
        }
        else {
          this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "no implicit conversion to integer");
        }
      }

      if (count == null) {
        return length === 0 ? nil : this[length - 1];
      }
      else if (count < 0) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "negative count given");
      }

      if (count > length) {
        count = length;
      }

      return this.slice(length - count, length);
    ;
    };

    def.$length = function() {

      return this.length;
    };

    def.$map = def.$collect;

    def['$map!'] = def['$collect!'];

    def.$pop = function(count) {


      var length = this.length;

      if (count == null) {
        return length === 0 ? nil : this.pop();
      }

      if (count < 0) {
        this.$raise("negative count given");
      }

      return count > length ? this.splice(0, this.length) : this.splice(length - count, length);
    ;
    };

    def.$push = function(objects) {
      objects = $slice.call(arguments, 0);

      for (var i = 0, length = objects.length; i < length; i++) {
        this.push(objects[i]);
      }

      return this;
    };

    def.$rassoc = function(object) {


      for (var i = 0, length = this.length, item; i < length; i++) {
        item = this[i];

        if (item.length && item[1] !== undefined) {
          if ((item[1])['$=='](object)) {
            return item;
          }
        }
      }

      return nil;
    ;
    };

    def.$reject = TMP_11 = function() {
      var $iter = TMP_11._p, block = $iter || nil;TMP_11._p = null;

      var result = [];

      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          result.push(this[i]);
        }
      }
      return result;

    };

    def['$reject!'] = TMP_12 = function() {
      var $a, $b, $iter = TMP_12._p, block = $iter || nil;TMP_12._p = null;

      var original = this.length;
      ($a = ($b = this).$delete_if, $a._p = block.$to_proc(), $a).call($b);
      return this.length === original ? nil : this;
    ;
    };

    def.$replace = function(other) {


      this.splice(0, this.length);
      this.push.apply(this, other);
      return this;
    ;
    };

    def.$reverse = function() {

      return this.slice(0).reverse();
    };

    def['$reverse!'] = function() {

      return this.reverse();
    };

    def.$reverse_each = TMP_13 = function() {
      var $a, $b, $iter = TMP_13._p, block = $iter || nil;TMP_13._p = null;
      ($a = ($b = this.$reverse()).$each, $a._p = block.$to_proc(), $a).call($b);
      return this;
    };

    def.$rindex = TMP_14 = function(object) {
      var $iter = TMP_14._p, block = $iter || nil;TMP_14._p = null;

      if (block !== nil) {
        for (var i = this.length - 1, value; i >= 0; i--) {
          if ((value = block(this[i])) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            return i;
          }
        }
      }
      else {
        for (var i = this.length - 1; i >= 0; i--) {
          if ((this[i])['$=='](object)) {
            return i;
          }
        }
      }

      return nil;
    ;
    };

    def.$select = TMP_15 = function() {
      var $iter = TMP_15._p, block = $iter || nil;TMP_15._p = null;

      var result = [];

      for (var i = 0, length = this.length, item, value; i < length; i++) {
        item = this[i];

        if ((value = block(item)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          result.push(item);
        }
      }

      return result;

    };

    def['$select!'] = TMP_16 = function() {
      var $a, $b, $iter = TMP_16._p, block = $iter || nil;TMP_16._p = null;

      var original = this.length;
      ($a = ($b = this).$keep_if, $a._p = block.$to_proc(), $a).call($b);
      return this.length === original ? nil : this;
    ;
    };

    def.$shift = function(count) {


      if (this.length === 0) {
        return nil;
      }

      return count == null ? this.shift() : this.splice(0, count)
    ;
    };

    def.$size = def.$length;

    def.$shuffle = function() {


        for (var i = this.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = this[i];
          this[i] = this[j];
          this[j] = tmp;
        }

        return this;
    ;
    };

    def.$slice = def['$[]'];

    def['$slice!'] = function(index, length) {


      if (index < 0) {
        index += this.length;
      }

      if (length != null) {
        return this.splice(index, length);
      }

      if (index < 0 || index >= this.length) {
        return nil;
      }

      return this.splice(index, 1)[0];
    ;
    };

    def.$sort = TMP_17 = function() {
      var $a, $iter = TMP_17._p, block = $iter || nil;TMP_17._p = null;

      var copy = this.slice();
      var t_arg_error = false;
      var t_break = [];

      if (block !== nil) {
        var result = copy.sort(function(x, y) {
          var result = block(x, y);
          if (result === $breaker) {
            t_break.push($breaker.$v);
          }
          if (result === nil) {
            t_arg_error = true;
          }
          if ((result != null) && (result)['$respond_to?']("<=>")) {
            result = result['$<=>'](0);
          }
          if (result !== -1 && result !== 0 && result !== 1) {
            t_arg_error = true;
          }
          return result;
        });

        if (t_break.length > 0)
          return t_break[0];
        if (t_arg_error)
          this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "Array#sort");

        return result;
      }

      var result = copy.sort(function(a, b){
        if (typeof(a) !== typeof(b)) {
          t_arg_error = true;
        }

        if (a['$<=>'] && typeof(a['$<=>']) == "function") {
          var result = a['$<=>'](b);
          if (result === nil) {
            t_arg_error = true;
          }
          return result;
        }
        if (a > b)
          return 1;
        if (a < b)
          return -1;
        return 0;
      });

      if (t_arg_error)
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "Array#sort");

      return result;
    ;
    };

    def['$sort!'] = TMP_18 = function() {
      var $iter = TMP_18._p, block = $iter || nil;TMP_18._p = null;

      var result;
      if (block !== nil) {
        //strangely
        result = this.slice().sort(block);
      } else {
        result = this.slice()['$sort']();
      }
      this.length = 0;
      for(var i = 0; i < result.length; i++) {
        this.push(result[i]);
      }
      return this;

    };

    def.$take = function(count) {

      return this.slice(0, count);
    };

    def.$take_while = TMP_19 = function() {
      var $iter = TMP_19._p, block = $iter || nil;TMP_19._p = null;

      var result = [];

      for (var i = 0, length = this.length, item, value; i < length; i++) {
        item = this[i];

        if ((value = block(item)) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          return result;
        }

        result.push(item);
      }

      return result;

    };

    def.$to_a = function() {

      return this;
    };

    def.$to_ary = def.$to_a;

    def.$to_n = function() {


      var result = [], obj

      for (var i = 0, len = this.length; i < len; i++) {
        obj = this[i];

        if (obj.$to_n) {
          result.push((obj).$to_n());
        }
        else {
          result.push(obj);
        }
      }

      return result;
    ;
    };

    def.$to_s = def.$inspect;

    def.$uniq = function() {


      var result = [],
          seen   = {};

      for (var i = 0, length = this.length, item, hash; i < length; i++) {
        item = this[i];
        hash = item;

        if (!seen[hash]) {
          seen[hash] = true;

          result.push(item);
        }
      }

      return result;

    };

    def['$uniq!'] = function() {


      var original = this.length,
          seen     = {};

      for (var i = 0, length = original, item, hash; i < length; i++) {
        item = this[i];
        hash = item;

        if (!seen[hash]) {
          seen[hash] = true;
        }
        else {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this.length === original ? nil : this;
    ;
    };

    def.$unshift = function(objects) {
      objects = $slice.call(arguments, 0);

      for (var i = objects.length - 1; i >= 0; i--) {
        this.unshift(objects[i]);
      }

      return this;

    };

    def.$zip = TMP_20 = function(others) {
      var $iter = TMP_20._p, block = $iter || nil;TMP_20._p = null;others = $slice.call(arguments, 0);

      var result = [], size = this.length, part, o;

      for (var i = 0; i < size; i++) {
        part = [this[i]];

        for (var j = 0, jj = others.length; j < jj; j++) {
          o = others[j][i];

          if (o == null) {
            o = nil;
          }

          part[j + 1] = o;
        }

        result[i] = part;
      }

      if (block !== nil) {
        for (var i = 0; i < size; i++) {
          block(result[i]);
        }

        return nil;
      }

      return result;
    ;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/array.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$==', '$call', '$enum_for', '$raise', '$flatten', '$inspect', '$to_n']);
  return (function($base, $super){
    function Hash() {};
    Hash = $klass($base, $super, "Hash", Hash);

    var def = Hash._proto, $scope = Hash._scope, $a, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12;
    def.proc = def.none = nil;

    Hash.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));


    var $hash = Opal.hash = function() {
      if (arguments.length == 1 && arguments[0]._klass == Hash) {
        return arguments[0];
      }

      var hash   = new Hash._alloc,
          args   = $slice.call(arguments),
          keys   = [],
          assocs = {};

      hash.map   = assocs;
      hash.keys  = keys;

      for (var i = 0, length = args.length, key; i < length; i++) {
        var key = args[i], obj = args[++i];

        if (assocs[key] == null) {
          keys.push(key);
        }

        assocs[key] = obj;
      }

      return hash;
    };



    var $hash2 = Opal.hash2 = function(keys, map) {
      var hash = new Hash._alloc;
      hash.keys = keys;
      hash.map = map;
      return hash;
    };


    var $hasOwn = {}.hasOwnProperty;

    Hash.constructor.prototype['$[]'] = function(objs) {
      objs = $slice.call(arguments, 0);
      return $hash.apply(null, objs);
    };

    Hash.constructor.prototype['$allocate'] = function() {


      var hash = new this._alloc;
      hash.map = {};
      hash.keys = [];
      return hash;
    ;
    };

    def.$initialize = TMP_1 = function(defaults) {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;

      if (defaults != null) {
        if (defaults.constructor == Object) {
          var map = this.map, keys = this.keys;

          for (var key in defaults) {
            keys.push(key);
            map[key] = defaults[key];
          }
        }
        else {
          this.none = defaults;
        }
      }
      else if (block !== nil) {
          this.proc = block;
      }

      return this;
    ;
    };

    def['$=='] = function(other) {
      var $a;

      if (this === other) {
        return true;
      }

      if (!other.map || !other.keys) {
        return false;
      }

      if (this.keys.length !== other.keys.length) {
        return false;
      }

      var map  = this.map,
          map2 = other.map;

      for (var i = 0, length = this.keys.length; i < length; i++) {
        var key = this.keys[i], obj = map[key], obj2 = map2[key];

        if (($a = (obj)['$=='](obj2), ($a === nil || $a === false))) {
          return false;
        }
      }

      return true;
    ;
    };

    def['$[]'] = function(key) {


      var bucket = this.map[key];

      if (bucket != null) {
        return bucket;
      }

      var proc = this.proc;

      if (proc !== nil) {
        return (proc).$call(this, key);
      }

      return this.none;
    ;
    };

    def['$[]='] = function(key, value) {


      var map = this.map;

      if (!$hasOwn.call(map, key)) {
        this.keys.push(key);
      }

      map[key] = value;

      return value;
    ;
    };

    def.$assoc = function(object) {


      var keys = this.keys, key;

      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];

        if ((key)['$=='](object)) {
          return [key, this.map[key]];
        }
      }

      return nil;
    ;
    };

    def.$clear = function() {


      this.map = {};
      this.keys = [];
      return this;
    ;
    };

    def.$clone = function() {


      var result = $hash(),
          map    = this.map,
          map2   = result.map,
          keys2  = result.keys;

      for (var i = 0, length = this.keys.length; i < length; i++) {
        keys2.push(this.keys[i]);
        map2[this.keys[i]] = map[this.keys[i]];
      }

      return result;
    ;
    };

    def.$default = function(val) {

      return this.none;
    };

    def['$default='] = function(object) {

      return this.none = object;
    };

    def.$default_proc = function() {

      return this.proc;
    };

    def['$default_proc='] = function(proc) {

      return this.proc = proc;
    };

    def.$delete = function(key) {


      var map  = this.map, result = map[key];

      if (result != null) {
        delete map[key];
        this.keys.$delete(key);

        return result;
      }

      return nil;
    ;
    };

    def.$delete_if = TMP_2 = function() {
      var $a, $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("delete_if")
      };

      var map = this.map, keys = this.keys, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
        }
      }

      return this;
    ;
    };

    def.$dup = def.$clone;

    def.$each = TMP_3 = function() {
      var $a, $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("each")
      };

      var map = this.map, keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if ($opal.$yield1(block, [key, map[key]]) === $breaker) return $breaker.$v;
      }

      return this;
    ;
    };

    def.$each_key = TMP_4 = function() {
      var $a, $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("each_key")
      };

      var keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if (block(key) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;
    ;
    };

    def.$each_pair = def.$each;

    def.$each_value = TMP_5 = function() {
      var $a, $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("each_value")
      };

      var map = this.map, keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        if (block(map[keys[i]]) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;
    ;
    };

    def['$empty?'] = function() {

      return this.keys.length === 0;
    };

    def['$eql?'] = def['$=='];

    def.$fetch = TMP_6 = function(key, defaults) {
      var $a, $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;

      var value = this.map[key];

      if (value != null) {
        return value;
      }

      if (block !== nil) {
        var value;

        if ((value = block(key)) === $breaker) {
          return $breaker.$v;
        }

        return value;
      }

      if (defaults != null) {
        return defaults;
      }

      this.$raise((($a = $scope.KeyError) == null ? $opal.cm("KeyError") : $a), "key not found");
    ;
    };

    def.$flatten = function(level) {


      var map = this.map, keys = this.keys, result = [];

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], value = map[key];

        result.push(key);

        if (value._isArray) {
          if (level == null || level === 1) {
            result.push(value);
          }
          else {
            result = result.concat((value).$flatten(level - 1));
          }
        }
        else {
          result.push(value);
        }
      }

      return result;
    ;
    };

    def['$has_key?'] = function(key) {

      return this.map[key] != null;
    };

    def['$has_value?'] = function(value) {


      for (var assoc in this.map) {
        if ((this.map[assoc])['$=='](value)) {
          return true;
        }
      }

      return false;
    ;
    };

    def.$hash = function() {

      return this._id;
    };

    def['$include?'] = def['$has_key?'];

    def.$index = function(object) {


      var map = this.map, keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if (object['$=='](map[key])) {
          return key;
        }
      }

      return nil;
    ;
    };

    def.$indexes = function(keys) {
      keys = $slice.call(arguments, 0);

      var result = [], map = this.map, val;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], val = map[key];

        if (val != null) {
          result.push(val);
        }
        else {
          result.push(this.none);
        }
      }

      return result;
    ;
    };

    def.$indices = def.$indexes;

    def.$inspect = function() {


      var inspect = [], keys = this.keys, map = this.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], val = map[key];

        if (val === this) {
          inspect.push((key).$inspect() + '=>' + '{...}');
        } else {
          inspect.push((key).$inspect() + '=>' + (map[key]).$inspect());
        }
      }

      return '{' + inspect.join(', ') + '}';
    ;
    };

    def.$invert = function() {


      var result = $hash(), keys = this.keys, map = this.map,
          keys2 = result.keys, map2 = result.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        keys2.push(obj);
        map2[obj] = key;
      }

      return result;
    ;
    };

    def.$keep_if = TMP_7 = function() {
      var $a, $iter = TMP_7._p, block = $iter || nil;TMP_7._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("keep_if")
      };

      var map = this.map, keys = this.keys, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
        }
      }

      return this;
    ;
    };

    def.$key = def.$index;

    def['$key?'] = def['$has_key?'];

    def.$keys = function() {


      return this.keys.slice(0);
    ;
    };

    def.$length = function() {


      return this.keys.length;
    ;
    };

    def['$member?'] = def['$has_key?'];

    def.$merge = TMP_8 = function(other) {
      var $iter = TMP_8._p, block = $iter || nil;TMP_8._p = null;

      var keys = this.keys, map = this.map,
          result = $hash(), keys2 = result.keys, map2 = result.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        keys2.push(key);
        map2[key] = map[key];
      }

      var keys = other.keys, map = other.map;

      if (block === nil) {
        for (var i = 0, length = keys.length; i < length; i++) {
          var key = keys[i];

          if (map2[key] == null) {
            keys2.push(key);
          }

          map2[key] = map[key];
        }
      }
      else {
        for (var i = 0, length = keys.length; i < length; i++) {
          var key = keys[i];

          if (map2[key] == null) {
            keys2.push(key);
            map2[key] = map[key];
          }
          else {
            map2[key] = block(key, map2[key], map[key]);
          }
        }
      }

      return result;
    ;
    };

    def['$merge!'] = TMP_9 = function(other) {
      var $iter = TMP_9._p, block = $iter || nil;TMP_9._p = null;

      var keys = this.keys, map = this.map,
          keys2 = other.keys, map2 = other.map;

      if (block === nil) {
        for (var i = 0, length = keys2.length; i < length; i++) {
          var key = keys2[i];

          if (map[key] == null) {
            keys.push(key);
          }

          map[key] = map2[key];
        }
      }
      else {
        for (var i = 0, length = keys2.length; i < length; i++) {
          var key = keys2[i];

          if (map[key] == null) {
            keys.push(key);
            map[key] = map2[key];
          }
          else {
            map[key] = block(key, map[key], map2[key]);
          }
        }
      }

      return this;
    ;
    };

    def.$rassoc = function(object) {


      var keys = this.keys, map = this.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((obj)['$=='](object)) {
          return [key, obj];
        }
      }

      return nil;
    ;
    };

    def.$reject = TMP_10 = function() {
      var $a, $iter = TMP_10._p, block = $iter || nil;TMP_10._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("reject")
      };

      var keys = this.keys, map = this.map,
          result = $hash(), map2 = result.map, keys2 = result.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key], value;

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          keys2.push(key);
          map2[key] = obj;
        }
      }

      return result;
    ;
    };

    def.$replace = function(other) {


      var map = this.map = {}, keys = this.keys = [];

      for (var i = 0, length = other.keys.length; i < length; i++) {
        var key = other.keys[i];
        keys.push(key);
        map[key] = other.map[key];
      }

      return this;
    ;
    };

    def.$select = TMP_11 = function() {
      var $a, $iter = TMP_11._p, block = $iter || nil;TMP_11._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("select")
      };

      var keys = this.keys, map = this.map,
          result = $hash(), map2 = result.map, keys2 = result.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key], value;

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          keys2.push(key);
          map2[key] = obj;
        }
      }

      return result;
    ;
    };

    def['$select!'] = TMP_12 = function() {
      var $a, $iter = TMP_12._p, block = $iter || nil;TMP_12._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("select!")
      };

      var map = this.map, keys = this.keys, value, result = nil;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
          result = this
        }
      }

      return result;
    ;
    };

    def.$shift = function() {


      var keys = this.keys, map = this.map;

      if (keys.length) {
        var key = keys[0], obj = map[key];

        delete map[key];
        keys.splice(0, 1);

        return [key, obj];
      }

      return nil;
    ;
    };

    def.$size = def.$length;

    def.$to_a = function() {


      var keys = this.keys, map = this.map, result = [];

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];
        result.push([key, map[key]]);
      }

      return result;
    ;
    };

    def.$to_hash = function() {

      return this;
    };

    def.$to_n = function() {


      var result = {}, keys = this.keys, map = this.map, bucket, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if (obj.$to_n) {
          result[key] = (obj).$to_n();
        }
        else {
          result[key] = obj;
        }
      }

      return result;
    ;
    };

    def.$to_s = def.$inspect;

    def.$update = def['$merge!'];

    def['$value?'] = function(value) {


      var map = this.map;

      for (var assoc in map) {
        var v = map[assoc];
        if ((v)['$=='](value)) {
          return true;
        }
      }

      return false;
    ;
    };

    def.$values_at = def.$indexes;

    def.$values = function() {


      var map    = this.map,
          result = [];

      for (var key in map) {
        result.push(map[key]);
      }

      return result;
    ;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/hash.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, $gvars = $opal.gvars;

  $opal.add_stubs(['$include', '$to_str', '$is_a?', '$format', '$raise', '$=~', '$ljust', '$floor', '$/', '$+', '$size', '$rjust', '$ceil', '$each', '$split', '$chomp', '$block_given?', '$escape', '$to_i', '$match', '$to_proc', '$new', '$[]', '$str', '$to_s', '$value', '$try_convert', '$class', '$attr_reader']);
  (function($base, $super){
    function String() {};
    String = $klass($base, $super, "String", String);

    var def = String._proto, $scope = String._scope, $a, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6;

    String.$include((($a = $scope.Comparable) == null ? $opal.cm("Comparable") : $a));

    def._isString = true;

    var native_string = "".constructor;

    String.constructor.prototype['$try_convert'] = function(what) {

      try {
        return what.$to_str()
      } catch ($err) {
      if (true){
        return nil}else { throw $err; }
      }
    };

    String.constructor.prototype['$new'] = function(str) {
      if (str == null) {
        str = ""
      }

      return new native_string(str)
    ;
    };

    def['$%'] = function(data) {
      var $a, $b;
      if (($a = data['$is_a?']((($b = $scope.Array) == null ? $opal.cm("Array") : $b))) !== false && $a !== nil) {
        return ($a = this).$format.apply($a, [this].concat(data))
      } else {
        return this.$format(this, data)
      };
    };

    def['$*'] = function(count) {


      if (count < 1) {
        return '';
      }

      var result  = '',
          pattern = this.valueOf();

      while (count > 0) {
        if (count & 1) {
          result += pattern;
        }

        count >>= 1, pattern += pattern;
      }

      return result;

    };

    def['$+'] = function(other) {

      return this.toString() + other;
    };

    def['$<=>'] = function(other) {


      if (typeof other !== 'string') {
        return nil;
      }

      return this > other ? 1 : (this < other ? -1 : 0);
    ;
    };

    def['$<'] = function(other) {

      return this < other;
    };

    def['$<='] = function(other) {

      return this <= other;
    };

    def['$>'] = function(other) {

      return this > other;
    };

    def['$>='] = function(other) {

      return this >= other;
    };

    def['$=='] = function(other) {

      return other == native_string(this);
    };

    def['$==='] = def['$=='];

    def['$=~'] = function(other) {


      if (typeof other === 'string') {
        this.$raise("string given");
      }

      return other['$=~'](this);
    ;
    };

    def['$[]'] = function(index, length) {


      var size = this.length;

      if (index._isRange) {
        var exclude = index.exclude,
            length  = index.end,
            index   = index.begin;

        if (index < 0) {
          index += size;
        }

        if (length < 0) {
          length += size;
        }

        if (!exclude) {
          length += 1;
        }

        if (index > size) {
          return nil;
        }

        length = length - index;

        if (length < 0) {
          length = 0;
        }

        return this.substr(index, length);
      }

      if (index < 0) {
        index += this.length;
      }

      if (length == null) {
        if (index >= this.length || index < 0) {
          return nil;
        }

        return this.substr(index, 1);
      }

      if (index > this.length || index < 0) {
        return nil;
      }

      return this.substr(index, length);
    ;
    };

    def.$capitalize = function() {

      return this.charAt(0).toUpperCase() + this.substr(1).toLowerCase();
    };

    def.$casecmp = function(other) {


      if (typeof other !== 'string') {
        return other;
      }

      var a = this.toLowerCase(),
          b = other.toLowerCase();

      return a > b ? 1 : (a < b ? -1 : 0);

    };

    def.$center = function(width, padstr) {
      if (padstr == null) {
        padstr = " "
      }

      if (width <= this.length) {
        return this;
      }
      else {
        var ljustified = this.$ljust(width['$+'](this.$size())['$/'](2).$floor(), padstr);
        var rjustified = this.$rjust(width['$+'](this.$size())['$/'](2).$ceil(), padstr);
        return ljustified + rjustified.slice(this.length);
      }
    ;
    };

    def.$chars = TMP_1 = function() {
      var $iter = TMP_1._p, $yield = $iter || nil;TMP_1._p = null;

      for (var i = 0, length = this.length; i < length; i++) {
        if ($opal.$yield1($yield, this.charAt(i)) === $breaker) return $breaker.$v
      }
    ;
    };

    def.$chomp = function(separator) {
      if (separator == null) {
        separator = $gvars["/"]
      }

      var strlen = this.length;
      var seplen = separator.length;
      if (strlen > 0) {
        if (separator === "\n") {
          var last = this.charAt(strlen - 1);
          if (last === "\n" || last == "\r") {
            var result = this.substr(0, strlen - 1);
            if (strlen > 1 && this.charAt(strlen - 2) === "\r") {
              result = this.substr(0, strlen - 2);
            }
            return result;
          }
        }
        else if (separator === "") {
          return this.replace(/(?:\n|\r\n)+$/, '');
        }
        else if (strlen >= seplen) {
          var tail = this.substr(-1 * seplen);
          if (tail === separator) {
            return this.substr(0, strlen - seplen);
          }
        }
      }
      return this
    ;
    };

    def.$chop = function() {

      return this.substr(0, this.length - 1);
    };

    def.$chr = function() {

      return this.charAt(0);
    };

    def.$clone = function() {

      return this.slice();
    };

    def.$count = function(str) {

      return (this.length - this.replace(new RegExp(str,"g"), '').length) / str.length;
    };

    def.$dup = def.$clone;

    def.$downcase = function() {

      return this.toLowerCase();
    };

    def.$each_char = def.$chars;

    def.$each_line = TMP_2 = function(separator) {
      var $iter = TMP_2._p, $yield = $iter || nil;TMP_2._p = null;if (separator == null) {
        separator = $gvars["/"]
      }
      if ($yield === nil) {
        return this.$split(separator).$each()
      };

      var chomped = this.$chomp();
      var trailing_separator = this.length != chomped.length
      var splitted = chomped.split(separator);

      if (!($yield !== nil)) {
        result = []
        for (var i = 0, length = splitted.length; i < length; i++) {
          if (i < length - 1 || trailing_separator) {
            result.push(splitted[i] + separator);
          }
          else {
            result.push(splitted[i]);
          }
        }

        return (result).$each();
      }

      for (var i = 0, length = splitted.length; i < length; i++) {
        if (i < length - 1 || trailing_separator) {
          if ($opal.$yield1($yield, splitted[i] + separator) === $breaker) return $breaker.$v
        }
        else {
          if ($opal.$yield1($yield, splitted[i]) === $breaker) return $breaker.$v
        }
      }
    ;
    };

    def['$empty?'] = function() {

      return this.length === 0;
    };

    def['$end_with?'] = function(suffixes) {
      suffixes = $slice.call(arguments, 0);

      for (var i = 0, length = suffixes.length; i < length; i++) {
        var suffix = suffixes[i];

        if (this.length >= suffix.length && this.substr(0 - suffix.length) === suffix) {
          return true;
        }
      }

      return false;
    ;
    };

    def['$eql?'] = def['$=='];

    def['$equal?'] = function(val) {

      return this.toString() === val.toString();
    };

    def.$getbyte = function(idx) {

      return this.charCodeAt(idx);
    };

    def.$gsub = TMP_3 = function(pattern, replace) {
      var $a, $b, $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      if (($a = pattern['$is_a?']((($b = $scope.String) == null ? $opal.cm("String") : $b))) !== false && $a !== nil) {
        pattern = (new RegExp("" + (($a = $scope.Regexp) == null ? $opal.cm("Regexp") : $a).$escape(pattern)))
      };

      var pattern = pattern.toString(),
          options = pattern.substr(pattern.lastIndexOf('/') + 1) + 'g',
          regexp  = pattern.substr(1, pattern.lastIndexOf('/') - 1);

      this.$sub._p = block;
      return this.$sub(new RegExp(regexp, options), replace);

    };

    def.$hash = function() {

      return this.toString();
    };

    def.$hex = function() {

      return this.$to_i(16);
    };

    def['$include?'] = function(other) {

      return this.indexOf(other) !== -1;
    };

    def.$index = function(what, offset) {
      var $a;if (offset == null) {
        offset = nil
      }

      if ( !(what != null && (what._isString || what._isRegexp)) ) {
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "type mismatch");
      }

      var result = -1;

      if (offset != null) {
        if (offset < 0) {
          offset = offset + this.length;
        }

        if (offset > this.length) {
          return nil;
        }

        if (what['$is_a?']((($a = $scope.Regexp) == null ? $opal.cm("Regexp") : $a))) {
          result = ((($a = what['$=~'](this.substr(offset))) !== false && $a !== nil) ? $a : -1)
        } else {
          result = this.substr(offset).indexOf(what);
        }

        if (result !== -1) {
          result += offset;
        }
      } else {
        if (what['$is_a?']((($a = $scope.Regexp) == null ? $opal.cm("Regexp") : $a))) {
          result = ((($a = what['$=~'](this)) !== false && $a !== nil) ? $a : -1)
        } else {
          result = this.indexOf(what);
        }
      }

      return result === -1 ? nil : result;
    ;
    };

    def.$inspect = function() {


      var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
          meta      = {
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
          };

      escapable.lastIndex = 0;

      return escapable.test(this) ? '"' + this.replace(escapable, function(a) {
        var c = meta[a];

        return typeof c === 'string' ? c :
          '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      }) + '"' : '"' + this + '"';
  ;
    };

    def.$intern = function() {

      return this;
    };

    def.$lines = def.$each_line;

    def.$length = function() {

      return this.length;
    };

    def.$ljust = function(width, padstr) {
      if (padstr == null) {
        padstr = " "
      }

      var length = this.length;

      if (width <= length) {
        return this;
      }
      else {
        var index = -1, result = "";

        while (++index < (width - length)) {
          result += padstr;
        }

        return this + result.slice(0, width - length);
      }
    ;
    };

    def.$lstrip = function() {

      return this.replace(/^\s*/, '');
    };

    def.$match = TMP_4 = function(pattern, pos) {
      var $a, $b, $c, $d, $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      return ($a = ($b = (function() { if (($c = pattern['$is_a?']((($d = $scope.Regexp) == null ? $opal.cm("Regexp") : $d))) !== false && $c !== nil) {
        return pattern
      } else {
        return (new RegExp("" + (($c = $scope.Regexp) == null ? $opal.cm("Regexp") : $c).$escape(pattern)))
      }; return nil; }).call(this)).$match, $a._p = block.$to_proc(), $a).call($b, this, pos);
    };

    def.$next = function() {


      if (this.length === 0) {
        return "";
      }

      var initial = this.substr(0, this.length - 1);
      var last    = native_string.fromCharCode(this.charCodeAt(this.length - 1) + 1);

      return initial + last;
    ;
    };

    def.$ord = function() {

      return this.charCodeAt(0);
    };

    def.$partition = function(str) {


      var result = this.split(str);
      var splitter = (result[0].length === this.length ? "" : str);

      return [result[0], splitter, result.slice(1).join(str.toString())];
    ;
    };

    def.$reverse = function() {

      return this.split('').reverse().join('');
    };

    def.$rindex = function(search, offset) {
      var $a;

      var search_type = (search == null ? Opal.NilClass : search.constructor);
      if (search_type != native_string && search_type != RegExp) {
        var msg = "type mismatch: " + search_type + " given";
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new(msg));
      }

      if (this.length == 0) {
        return search.length == 0 ? 0 : nil;
      }

      var result = -1;
      if (offset != null) {
        if (offset < 0) {
          offset = this.length + offset;
        }

        if (search_type == native_string) {
          result = this.lastIndexOf(search, offset);
        }
        else {
          result = this.substr(0, offset + 1).$reverse().search(search);
          if (result !== -1) {
            result = offset - result;
          }
        }
      }
      else {
        if (search_type == native_string) {
          result = this.lastIndexOf(search);
        }
        else {
          result = this.$reverse().search(search);
          if (result !== -1) {
            result = this.length - 1 - result;
          }
        }
      }

      return result === -1 ? nil : result;

    };

    def.$rjust = function(width, padstr) {
      if (padstr == null) {
        padstr = " "
      }

      if (width <= this.length) {
          return this;
      }
      else {
        var n_chars = Math.floor(width - this.length)
        var n_patterns = Math.floor(n_chars/padstr.length);
        var result = Array(n_patterns + 1).join(padstr);
        var remaining = n_chars - result.length;
        return result + padstr.slice(0, remaining) + this;
      }
    ;
    };

    def.$rstrip = function() {

      return this.replace(/\s*$/, '');
    };

    def.$scan = TMP_5 = function(pattern) {
      var $a, $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;

      if (pattern.global) {
        // should we clear it afterwards too?
        pattern.lastIndex = 0;
      }
      else {
        // rewrite regular expression to add the global flag to capture pre/post match
        pattern = new RegExp(pattern.source, 'g' + (pattern.multiline ? 'm' : '') + (pattern.ignoreCase ? 'i' : ''));
      }

      var result = [];
      var match;

      while ((match = pattern.exec(this)) != null) {
        var match_data = (($a = $scope.MatchData) == null ? $opal.cm("MatchData") : $a).$new(pattern, match);
        if (block === nil) {
          match.length == 1 ? result.push(match[0]) : result.push(match.slice(1));
        }
        else {
          match.length == 1 ? block(match[0]) : block.apply(this, match.slice(1));
        }
      }

      return (block !== nil ? this : result);
    ;
    };

    def.$size = def.$length;

    def.$slice = def['$[]'];

    def.$split = function(pattern, limit) {
      var $a;if (pattern == null) {
        pattern = ((($a = $gvars[";"]) !== false && $a !== nil) ? $a : " ")
      }
      return this.split(pattern, limit);
    };

    def['$start_with?'] = function(prefixes) {
      prefixes = $slice.call(arguments, 0);

      for (var i = 0, length = prefixes.length; i < length; i++) {
        if (this.indexOf(prefixes[i]) === 0) {
          return true;
        }
      }

      return false;

    };

    def.$strip = function() {

      return this.replace(/^\s*/, '').replace(/\s*$/, '');
    };

    def.$sub = TMP_6 = function(pattern, replace) {
      var $a, $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;

      if (typeof(replace) === 'string') {
        // convert Ruby back reference to JavaScript back reference
        replace = replace.replace(/\\([1-9])/g, '$$$1')
        return this.replace(pattern, replace);
      }
      if (block !== nil) {
        return this.replace(pattern, function() {
          // FIXME: this should be a formal MatchData object with all the goodies
          var match_data = []
          for (var i = 0, len = arguments.length; i < len; i++) {
            var arg = arguments[i];
            if (arg == undefined) {
              match_data.push(nil);
            }
            else {
              match_data.push(arg);
            }
          }

          var str = match_data.pop();
          var offset = match_data.pop();
          var match_len = match_data.length;

          // $1, $2, $3 not being parsed correctly in Ruby code
          //for (var i = 1; i < match_len; i++) {
          //  __gvars[String(i)] = match_data[i];
          //}
          $gvars["&"] = match_data[0];
          $gvars["~"] = match_data;
          return block(match_data[0]);
        });
      }
      else if (replace !== undefined) {
        if (replace['$is_a?']((($a = $scope.Hash) == null ? $opal.cm("Hash") : $a))) {
          return this.replace(pattern, function(str) {
            var value = replace['$[]'](this.$str());

            return (value == null) ? nil : this.$value().$to_s();
          });
        }
        else {
          replace = (($a = $scope.String) == null ? $opal.cm("String") : $a).$try_convert(replace);

          if (replace == null) {
            this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "can't convert " + (replace.$class()) + " into String");
          }

          return this.replace(pattern, replace);
        }
      }
      else {
        // convert Ruby back reference to JavaScript back reference
        replace = replace.toString().replace(/\\([1-9])/g, '$$$1')
        return this.replace(pattern, replace);
      }
    ;
    };

    def.$succ = def.$next;

    def.$sum = function(n) {
      if (n == null) {
        n = 16
      }

      var result = 0;

      for (var i = 0, length = this.length; i < length; i++) {
        result += (this.charCodeAt(i) % ((1 << n) - 1));
      }

      return result;

    };

    def.$swapcase = function() {


      var str = this.replace(/([a-z]+)|([A-Z]+)/g, function($0,$1,$2) {
        return $1 ? $0.toUpperCase() : $0.toLowerCase();
      });

      if (this.constructor === native_string) {
        return str;
      }

      return this.$class().$new(str);
    ;
    };

    def.$to_a = function() {


      if (this.length === 0) {
        return [];
      }

      return [this];
    ;
    };

    def.$to_f = function() {


      var result = parseFloat(this);

      return isNaN(result) ? 0 : result;
    ;
    };

    def.$to_i = function(base) {
      if (base == null) {
        base = 10
      }

      var result = parseInt(this, base);

      if (isNaN(result)) {
        return 0;
      }

      return result;
    ;
    };

    def.$to_proc = function() {


      var name = '$' + this;

      return function(arg) {
        var meth = arg[name];
        return meth ? meth.call(arg) : arg.$method_missing(name);
      };
    ;
    };

    def.$to_s = function() {

      return this.toString();
    };

    def.$to_str = def.$to_s;

    def.$to_sym = def.$intern;

    def.$to_n = function() {

      return this.valueOf();
    };

    def.$tr = function(from, to) {


      if (from.length == 0 || from === to) {
        return this;
      }

      var subs = {};
      var from_chars = from.split('');
      var from_length = from_chars.length;
      var to_chars = to.split('');
      var to_length = to_chars.length;

      var inverse = false;
      var global_sub = null;
      if (from_chars[0] === '^') {
        inverse = true;
        from_chars.shift();
        global_sub = to_chars[to_length - 1]
        from_length -= 1;
      }

      var from_chars_expanded = [];
      var last_from = null;
      var in_range = false;
      for (var i = 0; i < from_length; i++) {
        var char = from_chars[i];
        if (last_from == null) {
          last_from = char;
          from_chars_expanded.push(char);
        }
        else if (char === '-') {
          if (last_from === '-') {
            from_chars_expanded.push('-');
            from_chars_expanded.push('-');
          }
          else if (i == from_length - 1) {
            from_chars_expanded.push('-');
          }
          else {
            in_range = true;
          }
        }
        else if (in_range) {
          var start = last_from.charCodeAt(0) + 1;
          var end = char.charCodeAt(0);
          for (var c = start; c < end; c++) {
            from_chars_expanded.push(native_string.fromCharCode(c));
          }
          from_chars_expanded.push(char);
          in_range = null;
          last_from = null;
        }
        else {
          from_chars_expanded.push(char);
        }
      }

      from_chars = from_chars_expanded;
      from_length = from_chars.length;

      if (inverse) {
        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = true;
        }
      }
      else {
        if (to_length > 0) {
          var to_chars_expanded = [];
          var last_to = null;
          var in_range = false;
          for (var i = 0; i < to_length; i++) {
            var char = to_chars[i];
            if (last_from == null) {
              last_from = char;
              to_chars_expanded.push(char);
            }
            else if (char === '-') {
              if (last_to === '-') {
                to_chars_expanded.push('-');
                to_chars_expanded.push('-');
              }
              else if (i == to_length - 1) {
                to_chars_expanded.push('-');
              }
              else {
                in_range = true;
              }
            }
            else if (in_range) {
              var start = last_from.charCodeAt(0) + 1;
              var end = char.charCodeAt(0);
              for (var c = start; c < end; c++) {
                to_chars_expanded.push(native_string.fromCharCode(c));
              }
              to_chars_expanded.push(char);
              in_range = null;
              last_from = null;
            }
            else {
              to_chars_expanded.push(char);
            }
          }

          to_chars = to_chars_expanded;
          to_length = to_chars.length;
        }

        var length_diff = from_length - to_length;
        if (length_diff > 0) {
          var pad_char = (to_length > 0 ? to_chars[to_length - 1] : '');
          for (var i = 0; i < length_diff; i++) {
            to_chars.push(pad_char);
          }
        }

        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = to_chars[i];
        }
      }

      var new_str = ''
      for (var i = 0, length = this.length; i < length; i++) {
        var char = this.charAt(i);
        var sub = subs[char];
        if (inverse) {
          new_str += (sub == null ? global_sub : char);
        }
        else {
          new_str += (sub != null ? sub : char);
        }
      }
      return new_str;
    ;
    };

    def.$tr_s = function(from, to) {


      if (from.length == 0) {
        return this;
      }

      var subs = {};
      var from_chars = from.split('');
      var from_length = from_chars.length;
      var to_chars = to.split('');
      var to_length = to_chars.length;

      var inverse = false;
      var global_sub = null;
      if (from_chars[0] === '^') {
        inverse = true;
        from_chars.shift();
        global_sub = to_chars[to_length - 1]
        from_length -= 1;
      }

      var from_chars_expanded = [];
      var last_from = null;
      var in_range = false;
      for (var i = 0; i < from_length; i++) {
        var char = from_chars[i];
        if (last_from == null) {
          last_from = char;
          from_chars_expanded.push(char);
        }
        else if (char === '-') {
          if (last_from === '-') {
            from_chars_expanded.push('-');
            from_chars_expanded.push('-');
          }
          else if (i == from_length - 1) {
            from_chars_expanded.push('-');
          }
          else {
            in_range = true;
          }
        }
        else if (in_range) {
          var start = last_from.charCodeAt(0) + 1;
          var end = char.charCodeAt(0);
          for (var c = start; c < end; c++) {
            from_chars_expanded.push(native_string.fromCharCode(c));
          }
          from_chars_expanded.push(char);
          in_range = null;
          last_from = null;
        }
        else {
          from_chars_expanded.push(char);
        }
      }

      from_chars = from_chars_expanded;
      from_length = from_chars.length;

      if (inverse) {
        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = true;
        }
      }
      else {
        if (to_length > 0) {
          var to_chars_expanded = [];
          var last_to = null;
          var in_range = false;
          for (var i = 0; i < to_length; i++) {
            var char = to_chars[i];
            if (last_from == null) {
              last_from = char;
              to_chars_expanded.push(char);
            }
            else if (char === '-') {
              if (last_to === '-') {
                to_chars_expanded.push('-');
                to_chars_expanded.push('-');
              }
              else if (i == to_length - 1) {
                to_chars_expanded.push('-');
              }
              else {
                in_range = true;
              }
            }
            else if (in_range) {
              var start = last_from.charCodeAt(0) + 1;
              var end = char.charCodeAt(0);
              for (var c = start; c < end; c++) {
                to_chars_expanded.push(native_string.fromCharCode(c));
              }
              to_chars_expanded.push(char);
              in_range = null;
              last_from = null;
            }
            else {
              to_chars_expanded.push(char);
            }
          }

          to_chars = to_chars_expanded;
          to_length = to_chars.length;
        }

        var length_diff = from_length - to_length;
        if (length_diff > 0) {
          var pad_char = (to_length > 0 ? to_chars[to_length - 1] : '');
          for (var i = 0; i < length_diff; i++) {
            to_chars.push(pad_char);
          }
        }

        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = to_chars[i];
        }
      }
      var new_str = ''
      var last_substitute = null
      for (var i = 0, length = this.length; i < length; i++) {
        var char = this.charAt(i);
        var sub = subs[char]
        if (inverse) {
          if (sub == null) {
            if (last_substitute == null) {
              new_str += global_sub;
              last_substitute = true;
            }
          }
          else {
            new_str += char;
            last_substitute = null;
          }
        }
        else {
          if (sub != null) {
            if (last_substitute == null || last_substitute !== sub) {
              new_str += sub;
              last_substitute = sub;
            }
          }
          else {
            new_str += char;
            last_substitute = null;
          }
        }
      }
      return new_str;
    ;
    };

    def.$upcase = function() {

      return this.toUpperCase();
    };

    def.$freeze = function() {

      return this;
    };

    def['$frozen?'] = function() {

      return true;
    };

    return nil;
  })(self, null);
  $scope.Symbol = (($a = $scope.String) == null ? $opal.cm("String") : $a);
  return (function($base, $super){
    function MatchData() {};
    MatchData = $klass($base, $super, "MatchData", MatchData);

    var def = MatchData._proto, $scope = MatchData._scope;

    MatchData.$attr_reader("post_match", "pre_match", "regexp", "string");

    MatchData.constructor.prototype['$new'] = function(regexp, match_groups) {


      var instance = new Opal.MatchData._alloc;
      for (var i = 0, len = match_groups.length; i < len; i++) {
        var group = match_groups[i];
        if (group == undefined) {
          instance.push(nil);
        }
        else {
          instance.push(group);
        }
      }
      instance._begin = match_groups.index;
      instance.regexp = regexp;
      instance.string = match_groups.input;
      instance.pre_match = $gvars["`"] = instance.string.substr(0, regexp.lastIndex - instance[0].length);
      instance.post_match = $gvars["'"] = instance.string.substr(regexp.lastIndex);
      return $gvars["~"] = instance;

    };

    def.$begin = function(pos) {
      var $a;

      if (pos == 0 || pos == 1) {
        return this._begin;
      }
      else {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "MatchData#begin only supports 0th element");
      }
    ;
    };

    def.$captures = function() {

      return this.slice(1);
    };

    def.$inspect = function() {


      var str = "<#MatchData " + this[0].$inspect()
      for (var i = 1, len = this.length; i < len; i++) {
        str += " " + i + ":" + this[i].$inspect();
      }
      str += ">";
      return str;
    ;
    };

    def.$to_s = function() {

      return this[0];
    };

    def.$to_n = function() {

      return this.valueOf();
    };

    def.$values_at = function(indexes) {
      indexes = $slice.call(arguments, 0);

      var vals = [];
      var match_length = this.length;
      for (var i = 0, length = indexes.length; i < length; i++) {
        var pos = indexes[i];
        if (pos >= 0) {
          vals.push(this[pos]);
        }
        else {
          pos = match_length + pos;
          if (pos > 0) {
            vals.push(this[pos]);
          }
          else {
            vals.push(nil);
          }
        }
      }

      return vals;

    };

    return nil;
  })(self, (($a = $scope.Array) == null ? $opal.cm("Array") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/string.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$enum_for', '$is_a?']);
  (function($base, $super){
    function Numeric() {};
    Numeric = $klass($base, $super, "Numeric", Numeric);

    var def = Numeric._proto, $scope = Numeric._scope, $a, TMP_1, TMP_2, TMP_3, TMP_4;

    Numeric.$include((($a = $scope.Comparable) == null ? $opal.cm("Comparable") : $a));

    def._isNumber = true;

    def['$+'] = function(other) {

      return this + other;
    };

    def['$-'] = function(other) {

      return this - other;
    };

    def['$*'] = function(other) {

      return this * other;
    };

    def['$/'] = function(other) {

      return this / other;
    };

    def['$%'] = function(other) {

      return this % other;
    };

    def['$&'] = function(other) {

      return this & other;
    };

    def['$|'] = function(other) {

      return this | other;
    };

    def['$^'] = function(other) {

      return this ^ other;
    };

    def['$<'] = function(other) {

      return this < other;
    };

    def['$<='] = function(other) {

      return this <= other;
    };

    def['$>'] = function(other) {

      return this > other;
    };

    def['$>='] = function(other) {

      return this >= other;
    };

    def['$<<'] = function(count) {

      return this << count;
    };

    def['$>>'] = function(count) {

      return this >> count;
    };

    def['$+@'] = function() {

      return +this;
    };

    def['$-@'] = function() {

      return -this;
    };

    def['$~'] = function() {

      return ~this;
    };

    def['$**'] = function(other) {

      return Math.pow(this, other);
    };

    def['$=='] = function(other) {

      return !!(other._isNumber) && this == Number(other);
    };

    def['$<=>'] = function(other) {


      if (typeof(other) !== 'number') {
        return nil;
      }

      return this < other ? -1 : (this > other ? 1 : 0);
    ;
    };

    def.$abs = function() {

      return Math.abs(this);
    };

    def.$ceil = function() {

      return Math.ceil(this);
    };

    def.$chr = function() {

      return String.fromCharCode(this);
    };

    def.$downto = TMP_1 = function(finish) {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;

      for (var i = this; i >= finish; i--) {
        if (block(i) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;
    ;
    };

    def['$eql?'] = def['$=='];

    def['$even?'] = function() {

      return this % 2 === 0;
    };

    def.$floor = function() {

      return Math.floor(this);
    };

    def.$hash = function() {

      return this.toString();
    };

    def['$integer?'] = function() {

      return this % 1 === 0;
    };

    def.$magnitude = def.$abs;

    def.$modulo = def['$%'];

    def.$next = function() {

      return this + 1;
    };

    def['$nonzero?'] = function() {

      return this === 0 ? nil : this;
    };

    def['$odd?'] = function() {

      return this % 2 !== 0;
    };

    def.$ord = function() {

      return this;
    };

    def.$pred = function() {

      return this - 1;
    };

    def.$step = TMP_2 = function(limit, step) {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;if (step == null) {
        step = 1
      }

      var working = this;

      if (step > 0) {
        while (working <= limit) {
          block(working);
          working += step;
        }
      }
      else {
        while (working >= limit) {
          block(working);
          working += step;
        }
      }

      return this;
    ;
    };

    def.$succ = def.$next;

    def.$times = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;

      for (var i = 0; i < this; i++) {
        if (block(i) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;

    };

    def.$to_f = function() {

      return parseFloat(this);
    };

    def.$to_i = function() {

      return parseInt(this);
    };

    def.$to_s = function(base) {
      if (base == null) {
        base = 10
      }
      return this.toString();
    };

    def.$to_n = function() {

      return this.valueOf();
    };

    def.$upto = TMP_4 = function(finish) {
      var $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      if (block === nil) {
        return this.$enum_for("upto", finish)
      };

      for (var i = this; i <= finish; i++) {
        if (block(i) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;
    ;
    };

    def['$zero?'] = function() {

      return this == 0;
    };

    def.$size = function() {

      return 4;
    };

    return nil;
  })(self, null);
  $scope.Fixnum = (($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a);
  (function($base, $super){
    function Integer() {};
    Integer = $klass($base, $super, "Integer", Integer);

    var def = Integer._proto, $scope = Integer._scope;

    Integer.constructor.prototype['$==='] = function(other) {
      var $a;
      return ($a = other['$is_a?']((($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a)), $a !== false && $a !== nil ? (other % 1) == 0 : $a)
    };

    return nil;
  })(self, (($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a));
  return (function($base, $super){
    function Float() {};
    Float = $klass($base, $super, "Float", Float);

    var def = Float._proto, $scope = Float._scope;

    Float.constructor.prototype['$==='] = function(other) {
      var $a;
      return ($a = other['$is_a?']((($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a)), $a !== false && $a !== nil ? (other % 1) != 0 : $a)
    };

    return nil;
  })(self, (($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/numeric.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs([]);
  (function($base, $super){
    function Proc() {};
    Proc = $klass($base, $super, "Proc", Proc);

    var def = Proc._proto, $scope = Proc._scope, TMP_1;

    def._isProc = true;

    def.is_lambda = true;

    Proc.constructor.prototype['$new'] = TMP_1 = function() {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;
      if (block === nil) { throw new Error("no block given"); }
      block.is_lambda = false;
      return block;
    };

    def.$call = function(args) {
      args = $slice.call(arguments, 0);

      var result = this.apply(null, args);

      if (result === $breaker) {
        return $breaker.$v;
      }

      return result;
    ;
    };

    def['$[]'] = def.$call;

    def.$to_proc = function() {

      return this;
    };

    def['$lambda?'] = function() {

      return !!this.is_lambda;
    };

    def.$arity = function() {

      return this.length - 1;
    };

    def.$to_n = function() {

      return this;
    };

    return nil;
  })(self, null);
  return (function($base, $super){
    function Method() {};
    Method = $klass($base, $super, "Method", Method);

    var def = Method._proto, $scope = Method._scope;

    return nil
  })(self, (($a = $scope.Proc) == null ? $opal.cm("Proc") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/proc.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$attr_reader', '$<=', '$exclude_end?', '$-', '$end', '$min', '$==', '$max', '$succ', '$===', '$eql?', '$begin', '$raise']);
  return (function($base, $super){
    function Range() {};
    Range = $klass($base, $super, "Range", Range);

    var def = Range._proto, $scope = Range._scope, $a, TMP_1;

    Range.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));


    Range._proto._isRange = true;

    Opal.range = function(beg, end, exc) {
      var range         = new Range._alloc;
          range.begin   = beg;
          range.end     = end;
          range.exclude = exc;

      return range;
    };


    Range.$attr_reader("begin");

    Range.$attr_reader("end");

    def.$initialize = function(min, max, exclude) {
      if (exclude == null) {
        exclude = false
      }
      this.begin = min;
      this.end = max;
      return this.exclude = exclude;
    };

    def['$=='] = function(other) {


      if (!other._isRange) {
        return false;
      }

      return this.exclude === other.exclude && this.begin == other.begin && this.end == other.end;
    ;
    };

    def['$==='] = function(obj) {

      return obj >= this.begin && (this.exclude ? obj < this.end : obj <= this.end);
    };

    def['$cover?'] = function(value) {
      var $a, $b;
      return (($a = (this.begin)['$<='](value)) ? value['$<=']((function() { if (($b = this['$exclude_end?']()) !== false && $b !== nil) {
        return (this.end)['$-'](1)
      } else {
        return this.end;
      }; return nil; }).call(this)) : $a);
    };

    def.$last = function() {

      return this.$end();
    };

    def.$each = TMP_1 = function() {
      var $a, $b, $c, $iter = TMP_1._p, block = $iter || nil, current = nil;TMP_1._p = null;
      current = this.$min();
      while (($b = ($c = current['$=='](this.$max()), ($c === nil || $c === false))) !== false && $b !== nil){if ($opal.$yield1(block, current) === $breaker) return $breaker.$v;
      current = current.$succ();};
      if (($a = this['$exclude_end?']()) === false || $a === nil) {
        if ($opal.$yield1(block, current) === $breaker) return $breaker.$v
      };
      return this;
    };

    def['$eql?'] = function(other) {
      var $a, $b;
      if (($a = (($b = $scope.Range) == null ? $opal.cm("Range") : $b)['$==='](other)) === false || $a === nil) {
        return false
      };
      return ($a = (($a = this['$exclude_end?']()['$=='](other['$exclude_end?']())) ? (this.begin)['$eql?'](other.$begin()) : $a), $a !== false && $a !== nil ? (this.end)['$eql?'](other.$end()) : $a);
    };

    def['$exclude_end?'] = function() {

      return this.exclude;
    };

    def['$include?'] = function(obj) {

      return obj >= this.begin && obj <= this.end;
    };

    def.$max = def.$end;

    def.$min = def.$begin;

    def['$member?'] = def['$include?'];

    def.$step = function(n) {
      var $a;if (n == null) {
        n = 1
      }
      return this.$raise((($a = $scope.NotImplementedError) == null ? $opal.cm("NotImplementedError") : $a));
    };

    def.$to_s = function() {

      return this.begin + (this.exclude ? '...' : '..') + this.end;
    };

    return def.$inspect = def.$to_s;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/range.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, days_of_week = nil, short_days = nil, short_months = nil, long_months = nil;

  $opal.add_stubs(['$include', '$allocate', '$+', '$to_f', '$-', '$<=>', '$is_a?', '$zero?']);
  days_of_week = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  short_days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  short_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  long_months = ["January", "Febuary", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (function($base, $super){
    function Time() {};
    Time = $klass($base, $super, "Time", Time);

    var def = Time._proto, $scope = Time._scope, $a;

    Time.$include((($a = $scope.Comparable) == null ? $opal.cm("Comparable") : $a));

    Time.constructor.prototype['$at'] = function(seconds, frac) {
      if (frac == null) {
        frac = 0
      }
      return new Date(seconds * 1000 + frac);
    };

    Time.constructor.prototype['$new'] = function(year, month, day, hour, minute, second, millisecond) {


      switch (arguments.length) {
        case 1:
          return new Date(year);
        case 2:
          return new Date(year, month - 1);
        case 3:
          return new Date(year, month - 1, day);
        case 4:
          return new Date(year, month - 1, day, hour);
        case 5:
          return new Date(year, month - 1, day, hour, minute);
        case 6:
          return new Date(year, month - 1, day, hour, minute, second);
        case 7:
          return new Date(year, month - 1, day, hour, minute, second, millisecond);
        default:
          return new Date();
      }

    };

    Time.constructor.prototype['$now'] = function() {

      return new Date();
    };

    Time.constructor.prototype['$parse'] = function(str) {

      return Date.parse(str);
    };

    def['$+'] = function(other) {
      var $a;
      return (($a = $scope.Time) == null ? $opal.cm("Time") : $a).$allocate(this.$to_f()['$+'](other.$to_f()));
    };

    def['$-'] = function(other) {
      var $a;
      return (($a = $scope.Time) == null ? $opal.cm("Time") : $a).$allocate(this.$to_f()['$-'](other.$to_f()));
    };

    def['$<=>'] = function(other) {

      return this.$to_f()['$<=>'](other.$to_f());
    };

    def.$day = function() {

      return this.getDate();
    };

    def['$eql?'] = function(other) {
      var $a;
      return ($a = other['$is_a?']((($a = $scope.Time) == null ? $opal.cm("Time") : $a)), $a !== false && $a !== nil ? this['$<=>'](other)['$zero?']() : $a);
    };

    def['$friday?'] = function() {

      return this.getDay() === 5;
    };

    def.$hour = function() {

      return this.getHours();
    };

    def.$inspect = function() {

      return this.toString();
    };

    def.$mday = def.$day;

    def.$min = function() {

      return this.getMinutes();
    };

    def.$mon = function() {

      return this.getMonth() + 1;
    };

    def['$monday?'] = function() {

      return this.getDay() === 1;
    };

    def.$month = def.$mon;

    def['$saturday?'] = function() {

      return this.getDay() === 6;
    };

    def.$sec = function() {

      return this.getSeconds();
    };

    def.$strftime = function(format) {
      if (format == null) {
        format = ""
      }

      var d = this;

      return format.replace(/%(-?.)/g, function(full, m) {
        switch (m) {
          case 'a': return short_days[d.getDay()];
          case 'A': return days_of_week[d.getDay()];
          case 'b': return short_months[d.getMonth()];
          case 'B': return long_months[d.getMonth()];
          case '-d': return d.getDate();
          case 'Y': return d.getFullYear();
          default: return m ;
        }
      });
    ;
    };

    def['$sunday?'] = function() {

      return this.getDay() === 0;
    };

    def['$thursday?'] = function() {

      return this.getDay() === 4;
    };

    def.$to_f = function() {

      return this.getTime() / 1000;
    };

    def.$to_i = function() {

      return parseInt(this.getTime() / 1000);
    };

    def.$to_s = def.$inspect;

    def['$tuesday?'] = function() {

      return this.getDay() === 2;
    };

    def.$wday = function() {

      return this.getDay();
    };

    def['$wednesday?'] = function() {

      return this.getDay() === 3;
    };

    def.$year = function() {

      return this.getFullYear();
    };

    def.$to_n = function() {

      return this;
    };

    return nil;
  })(self, null);
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/time.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$==', '$[]', '$upcase', '$const_set', '$new', '$unshift', '$define_struct_attribute', '$each', '$raise', '$<<', '$members', '$instance_variable_get', '$define_method', '$instance_variable_set', '$include', '$length', '$native?', '$Native', '$each_with_index', '$class', '$===', '$>=', '$size', '$include?', '$to_sym', '$enum_for', '$hash', '$all?', '$map', '$to_n', '$each_pair', '$+', '$name', '$join', '$inspect']);
  return (function($base, $super){
    function Struct() {};
    Struct = $klass($base, $super, "Struct", Struct);

    var def = Struct._proto, $scope = Struct._scope, TMP_1, $a, TMP_8, TMP_10;

    Struct.constructor.prototype['$new'] = TMP_1 = function(name, args) {
var $zuper = $slice.call(arguments, 0);      var $a, $b, TMP_2, $c, $d, $iter = TMP_1._p, $yield = $iter || nil;TMP_1._p = null;args = $slice.call(arguments, 1);
      if (($a = this['$==']((($b = $scope.Struct) == null ? $opal.cm("Struct") : $b))) === false || $a === nil) {
        return $opal.dispatch_super(this, "new",$zuper, $iter, Struct)
      };
      if (name['$[]'](0)['$=='](name['$[]'](0).$upcase())) {
        return (($a = $scope.Struct) == null ? $opal.cm("Struct") : $a).$const_set(name, ($a = this).$new.apply($a, [].concat(args)))
      } else {
        args.$unshift(name);
        return ($b = ($c = (($d = $scope.Class) == null ? $opal.cm("Class") : $d)).$new, $b._p = (TMP_2 = function() {

          var self = TMP_2._s || this, TMP_3, $a, $b;

          return ($a = ($b = args).$each, $a._p = (TMP_3 = function(arg) {

            var self = TMP_3._s || this;
            if (arg == null) arg = nil;

            return self.$define_struct_attribute(arg)
          }, TMP_3._s = self, TMP_3), $a).call($b)
        }, TMP_2._s = this, TMP_2), $b).call($c, this);
      };
    };

    Struct.constructor.prototype['$define_struct_attribute'] = function(name) {
      var $a, TMP_4, $b, TMP_5, $c;
      if (this['$==']((($a = $scope.Struct) == null ? $opal.cm("Struct") : $a))) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "you cannot define attributes to the Struct class")
      };
      this.$members()['$<<'](name);
      ($a = ($b = this).$define_method, $a._p = (TMP_4 = function() {

        var self = TMP_4._s || this;

        return self.$instance_variable_get("@" + (name))
      }, TMP_4._s = this, TMP_4), $a).call($b, name);
      return ($a = ($c = this).$define_method, $a._p = (TMP_5 = function(value) {

        var self = TMP_5._s || this;
        if (value == null) value = nil;

        return self.$instance_variable_set("@" + (name), value)
      }, TMP_5._s = this, TMP_5), $a).call($c, "" + (name) + "=");
    };

    Struct.constructor.prototype['$members'] = function() {
      var $a;
      if (this.members == null) this.members = nil;

      if (this['$==']((($a = $scope.Struct) == null ? $opal.cm("Struct") : $a))) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "the Struct class has no members")
      };
      return ((($a = this.members) !== false && $a !== nil) ? $a : this.members = []);
    };

    Struct.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));

    def.$initialize = function(args) {
      var $a, $b, TMP_6, TMP_7, $c, object = nil;args = $slice.call(arguments, 0);
      if (($a = (($b = args.$length()['$=='](1)) ? this['$native?'](args['$[]'](0)) : $b)) !== false && $a !== nil) {
        object = args['$[]'](0);
        return ($a = ($b = this.$members()).$each, $a._p = (TMP_6 = function(name) {

          var self = TMP_6._s || this;
          if (name == null) name = nil;

          return self.$instance_variable_set("@" + (name), self.$Native(object[name]))
        }, TMP_6._s = this, TMP_6), $a).call($b);
      } else {
        return ($a = ($c = this.$members()).$each_with_index, $a._p = (TMP_7 = function(name, index) {

          var self = TMP_7._s || this;
          if (name == null) name = nil;
if (index == null) index = nil;

          return self.$instance_variable_set("@" + (name), args['$[]'](index))
        }, TMP_7._s = this, TMP_7), $a).call($c)
      };
    };

    def.$members = function() {

      return this.$class().$members();
    };

    def['$[]'] = function(name) {
      var $a, $b;
      if (($a = (($b = $scope.Integer) == null ? $opal.cm("Integer") : $b)['$==='](name)) !== false && $a !== nil) {
        if (name['$>='](this.$members().$size())) {
          this.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a), "offset " + (name) + " too large for struct(size:" + (this.$members().$size()) + ")")
        };
        name = this.$members()['$[]'](name);
      } else {
        if (($a = this.$members()['$include?'](name.$to_sym())) === false || $a === nil) {
          this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "no member '" + (name) + "' in struct")
        }
      };
      return this.$instance_variable_get("@" + (name));
    };

    def['$[]='] = function(name, value) {
      var $a, $b;
      if (($a = (($b = $scope.Integer) == null ? $opal.cm("Integer") : $b)['$==='](name)) !== false && $a !== nil) {
        if (name['$>='](this.$members().$size())) {
          this.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a), "offset " + (name) + " too large for struct(size:" + (this.$members().$size()) + ")")
        };
        name = this.$members()['$[]'](name);
      } else {
        if (($a = this.$members()['$include?'](name.$to_sym())) === false || $a === nil) {
          this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "no member '" + (name) + "' in struct")
        }
      };
      return this.$instance_variable_set("@" + (name), value);
    };

    def.$each = TMP_8 = function() {
      var TMP_9, $a, $b, $iter = TMP_8._p, $yield = $iter || nil;TMP_8._p = null;
      if ($yield === nil) {
        return this.$enum_for("each")
      };
      return ($a = ($b = this.$members()).$each, $a._p = (TMP_9 = function(name) {

        var self = TMP_9._s || this, $a;
        if (name == null) name = nil;

        return $a = $opal.$yield1($yield, self['$[]'](name)), $a === $breaker ? $a : $a
      }, TMP_9._s = this, TMP_9), $a).call($b);
    };

    def.$each_pair = TMP_10 = function() {
      var TMP_11, $a, $b, $iter = TMP_10._p, $yield = $iter || nil;TMP_10._p = null;
      if ($yield === nil) {
        return this.$enum_for("each_pair")
      };
      return ($a = ($b = this.$members()).$each, $a._p = (TMP_11 = function(name) {

        var self = TMP_11._s || this, $a;
        if (name == null) name = nil;

        return $a = $opal.$yieldX($yield, [name, self['$[]'](name)]), $a === $breaker ? $a : $a
      }, TMP_11._s = this, TMP_11), $a).call($b);
    };

    def['$eql?'] = function(other) {
      var $a, TMP_12, $b, $c;
      return ((($a = this.$hash()['$=='](other.$hash())) !== false && $a !== nil) ? $a : ($b = ($c = other.$each_with_index())['$all?'], $b._p = (TMP_12 = function(object, index) {

        var self = TMP_12._s || this;
        if (object == null) object = nil;
if (index == null) index = nil;

        return self['$[]'](self.$members()['$[]'](index))['$=='](object)
      }, TMP_12._s = this, TMP_12), $b).call($c));
    };

    def.$length = function() {

      return this.$members().$length();
    };

    def.$size = def.$length;

    def.$to_a = function() {
      var TMP_13, $a, $b;
      return ($a = ($b = this.$members()).$map, $a._p = (TMP_13 = function(name) {

        var self = TMP_13._s || this;
        if (name == null) name = nil;

        return self['$[]'](name)
      }, TMP_13._s = this, TMP_13), $a).call($b);
    };

    def.$values = def.$to_a;

    def.$to_n = function() {
      var TMP_14, $a, $b, result = nil;
      result = {};
      ($a = ($b = this).$each_pair, $a._p = (TMP_14 = function(name, value) {

        var self = TMP_14._s || this;
        if (name == null) name = nil;
if (value == null) value = nil;

        return result[name] = value.$to_n();
      }, TMP_14._s = this, TMP_14), $a).call($b);
      return result;
    };

    def.$inspect = function() {
      var $a, TMP_15, $b, result = nil;
      result = "#<struct ";
      if (this.$class()['$==']((($a = $scope.Struct) == null ? $opal.cm("Struct") : $a))) {
        result = result['$+']("" + (this.$class().$name()) + " ")
      };
      result = result['$+'](($a = ($b = this.$each_pair()).$map, $a._p = (TMP_15 = function(name, value) {

        var self = TMP_15._s || this;
        if (name == null) name = nil;
if (value == null) value = nil;

        return "" + (name) + "=" + (value.$inspect())
      }, TMP_15._s = this, TMP_15), $a).call($b).$join(", "));
      result = result['$+'](">");
      return result;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/struct.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $klass = $opal.klass;

  $opal.add_stubs(['$native?', '$new', '$call', '$define_method', '$extend', '$instance_eval', '$raise', '$respond_to?', '$to_n', '$try_convert', '$<<', '$Native', '$include', '$nil?', '$[]=', '$slice', '$-', '$length', '$[]', '$to_proc']);
  (function($base){
    function Kernel() {};
    Kernel = $module($base, "Kernel", Kernel);
    var def = Kernel._proto, $scope = Kernel._scope;

    def['$native?'] = function(value) {

      return value == null || !value._klass;
    };

    def.$Native = function(obj) {
      var $a;
      if (($a = this['$native?'](obj)) !== false && $a !== nil) {
        return (($a = $scope.Native) == null ? $opal.cm("Native") : $a).$new(obj)
      } else {
        return obj
      };
    };
    ;$opal.donate(Kernel, ["$native?", "$Native"]);
  })(self);
  return (function($base, $super){
    function Native() {};
    Native = $klass($base, $super, "Native", Native);

    var def = Native._proto, $scope = Native._scope, TMP_3, $a, TMP_4, TMP_5;
    def['native'] = nil;

    (function($base){
      function Base() {};
      Base = $module($base, "Base", Base);
      var def = Base._proto, $scope = Base._scope;

      (function($base){
        function Helpers() {};
        Helpers = $module($base, "Helpers", Helpers);
        var def = Helpers._proto, $scope = Helpers._scope;

        def.$alias_native = function(new$, old) {
          var TMP_1, $a, $b;
          return ($a = ($b = this).$define_method, $a._p = (TMP_1 = function(args) {

            var self = TMP_1._s || this, $a, $b;
            if (self['native'] == null) self['native'] = nil;

            args = $slice.call(arguments, 0);
            return ($a = (($b = $scope.Native) == null ? $opal.cm("Native") : $b)).$call.apply($a, [self['native'], old].concat(args))
          }, TMP_1._s = this, TMP_1), $a).call($b, new$);
        }
        ;$opal.donate(Helpers, ["$alias_native"]);
      })(Base);

      Base.constructor.prototype['$included'] = function(klass) {
        var TMP_2, $a, $b;
        return ($a = ($b = klass).$instance_eval, $a._p = (TMP_2 = function() {

          var self = TMP_2._s || this, $a;

          return self.$extend((($a = $scope.Helpers) == null ? $opal.cm("Helpers") : $a))
        }, TMP_2._s = this, TMP_2), $a).call($b)
      };

      def.$initialize = function(native$) {
        var $a;
        if (($a = this['$native?'](native$)) === false || $a === nil) {
          this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "the passed value isn't native")
        };
        return this['native'] = native$;
      };

      def.$to_n = function() {

        if (this['native'] == null) this['native'] = nil;

        return this['native'];
      };
      ;$opal.donate(Base, ["$initialize", "$to_n"]);
    })(Native);

    Native.constructor.prototype['$try_convert'] = function(value) {


      if (this['$native?'](value)) {
        return value.valueOf();
      }
      else if (value['$respond_to?']("to_n")) {
        return value.$to_n();
      }
      else {
        return nil;
      }
    ;
    };

    Native.constructor.prototype['$convert'] = function(value) {
      var $a, native$ = nil;
      native$ = this.$try_convert(value);
      if (($a = native$ === nil) !== false && $a !== nil) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "the passed value isn't a native")
      };
      return native$;
    };

    Native.constructor.prototype['$call'] = TMP_3 = function(obj, key, args) {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;args = $slice.call(arguments, 2);
      if (block !== false && block !== nil) {
        args['$<<'](block)
      };

      var prop = obj[key];

      if (prop == null) {
        return nil;
      }
      else if (prop instanceof Function) {
        var result = prop.apply(obj, args);

        return result == null ? nil : result;
      }
      else if (this['$native?'](prop)) {
        return this.$Native(prop);
      }
      else {
        return prop;
      }
    ;
    };

    Native.$include((($a = $scope.Base) == null ? $opal.cm("Base") : $a));

    def['$nil?'] = function() {

      return this['native'] == null;
    };

    def.$each = TMP_4 = function() {
      var $a, $iter = TMP_4._p, $yield = $iter || nil;TMP_4._p = null;
      if ($yield === nil) {
        return (($a = $scope.Enumerator) == null ? $opal.cm("Enumerator") : $a).$new(this, "each")
      };

      for (var key in this['native']) {
        if ($opal.$yieldX($yield, [key, this['native'][key]]) === $breaker) return $breaker.$v
      }
    ;
      return this;
    };

    def['$[]'] = function(key) {
      var $a;
      if (($a = this['$nil?']()) !== false && $a !== nil) {
        this.$raise("cannot get value from nil native")
      };

      var prop = this['native'][key];

      if (prop instanceof Function) {
        return prop;
      }
      else {
        return (($a = $opal.Object._scope.Native) == null ? $opal.cm('Native') : $a).$call(this['native'], key)
      }
    ;
    };

    def['$[]='] = function(key, value) {
      var $a, native$ = nil;
      if (($a = this['$nil?']()) !== false && $a !== nil) {
        this.$raise("cannot set value on nil native")
      };
      native$ = (($a = $scope.Native) == null ? $opal.cm("Native") : $a).$try_convert(value);
      if (($a = native$ === nil) !== false && $a !== nil) {
        return this['native'][key] = value;
      } else {
        return this['native'][key] = native$;
      };
    };

    def.$method_missing = TMP_5 = function(mid, args) {
      var $a, $b, $c, $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;args = $slice.call(arguments, 1);
      if (($a = this['$nil?']()) !== false && $a !== nil) {
        this.$raise("cannot call method from nil native")
      };

      if (mid.charAt(mid.length - 1) === '=') {
        return this['$[]='](mid.$slice(0, mid.$length()['$-'](1)), args['$[]'](0));
      }
      else {
        return ($a = ($b = (($c = $opal.Object._scope.Native) == null ? $opal.cm('Native') : $c)).$call, $a._p = block.$to_proc(), $a).apply($b, [this['native'], mid].concat(args));
      }
    ;
    };

    return nil;
  })(self, (($a = $scope.BasicObject) == null ? $opal.cm("BasicObject") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/native.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, $module = $opal.module, $gvars = $opal.gvars;

  $opal.add_stubs(['$write', '$join', '$String', '$map', '$getbyte', '$getc', '$raise']);
  return (function($base, $super){
    function IO() {};
    IO = $klass($base, $super, "IO", IO);

    var def = IO._proto, $scope = IO._scope;

    $scope.SEEK_SET = 0;

    $scope.SEEK_CUR = 1;

    $scope.SEEK_END = 2;

    (function($base){
      function Writable() {};
      Writable = $module($base, "Writable", Writable);
      var def = Writable._proto, $scope = Writable._scope;

      def['$<<'] = function(string) {

        this.$write(string);
        return this;
      };

      def.$print = function(args) {
        var TMP_1, $a, $b;args = $slice.call(arguments, 0);
        return this.$write(($a = ($b = args).$map, $a._p = (TMP_1 = function(arg) {

          var self = TMP_1._s || this;
          if (arg == null) arg = nil;

          return self.$String(arg)
        }, TMP_1._s = this, TMP_1), $a).call($b).$join($gvars[","]));
      };

      def.$puts = function(args) {
        var TMP_2, $a, $b;args = $slice.call(arguments, 0);
        return this.$write(($a = ($b = args).$map, $a._p = (TMP_2 = function(arg) {

          var self = TMP_2._s || this;
          if (arg == null) arg = nil;

          return self.$String(arg)
        }, TMP_2._s = this, TMP_2), $a).call($b).$join($gvars["/"]));
      };
      ;$opal.donate(Writable, ["$<<", "$print", "$puts"]);
    })(IO);

    return (function($base){
      function Readable() {};
      Readable = $module($base, "Readable", Readable);
      var def = Readable._proto, $scope = Readable._scope;

      def.$readbyte = function() {

        return this.$getbyte();
      };

      def.$readchar = function() {

        return this.$getc();
      };

      def.$readline = function(sep) {
        var $a;if (sep == null) {
          sep = $gvars["/"]
        }
        return this.$raise((($a = $scope.NotImplementedError) == null ? $opal.cm("NotImplementedError") : $a));
      };

      def.$readpartial = function(integer, outbuf) {
        var $a;if (outbuf == null) {
          outbuf = nil
        }
        return this.$raise((($a = $scope.NotImplementedError) == null ? $opal.cm("NotImplementedError") : $a));
      };
      ;$opal.donate(Readable, ["$readbyte", "$readchar", "$readline", "$readpartial"]);
    })(IO);
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/io.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $gvars = $opal.gvars, $hash2 = $opal.hash2;

  $opal.add_stubs(['$Native', '$new', '$puts', '$to_s', '$include']);
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  $gvars["&"] = $gvars["~"] = $gvars["`"] = $gvars["'"] = nil;
  $gvars[":"] = [];
  $gvars["/"] = "\n";
  $gvars[","] = " ";
  $gvars["$"] = $gvars["global"] = self.$Native(Opal.global);
  $scope.ARGV = [];
  $scope.ARGF = (($a = $scope.Object) == null ? $opal.cm("Object") : $a).$new();
  $scope.ENV = $hash2([], {});
  $scope.TRUE = true;
  $scope.FALSE = false;
  $scope.NIL = nil;
  $scope.STDERR = $gvars["stderr"] = (($a = $scope.IO) == null ? $opal.cm("IO") : $a).$new();
  $scope.STDIN = $gvars["stdin"] = (($a = $scope.IO) == null ? $opal.cm("IO") : $a).$new();
  $scope.STDOUT = $gvars["stdout"] = (($a = $scope.IO) == null ? $opal.cm("IO") : $a).$new();
  $gvars["stdout"].$puts = function(strs) {
    var $a;strs = $slice.call(arguments, 0);

    for (var i = 0; i < strs.length; i++) {
      if(strs[i] instanceof Array) {
        ($a = this).$puts.apply($a, [].concat((strs[i])))
      } else {
        $opal.puts((strs[i]).$to_s());
      }
    }
  ;
    return nil;
  };
  $scope.RUBY_PLATFORM = "opal";
  $scope.RUBY_ENGINE = "opal";
  $scope.RUBY_VERSION = "1.9.3";
  $scope.RUBY_ENGINE_VERSION = "0.4.4";
  $scope.RUBY_RELEASE_DATE = "2013-08-13";
  self.$to_s = function() {

    return "main"
  };
  return self.$include = function(mod) {
    var $a;
    return (($a = $scope.Object) == null ? $opal.cm("Object") : $a).$include(mod)
  };
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/opal.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var TMP_1, TMP_4, TMP_6, self = $opal.top, $scope = $opal, nil = $opal.nil, def = $opal.Object._proto, $breaker = $opal.breaker, $slice = $opal.slice, $hash2 = $opal.hash2;

  $opal.add_stubs(['$raise', '$const_set', '$class', '$attr_accessor', '$name', '$is_a?', '$send', '$each_pair', '$puts', '$new', '$const_get', '$attributes=', '$[]=', '$call', '$[]', '$block_given?', '$scene_def', '$lambda', '$scene_run']);
  ;
  def.$entity = TMP_1 = function(class_sym) {
    var TMP_2, $a, $b, $c, $iter = TMP_1._p, $yield = $iter || nil, klass = nil;TMP_1._p = null;
    if ($yield === nil) {
      this.$raise()
    };
    this.$class().$const_set(class_sym, ($a = ($b = (($c = $scope.Class) == null ? $opal.cm("Class") : $c)).$new, $a._p = (TMP_2 = function() {

      var self = TMP_2._s || this;

      return (function(){var $scope = this._scope, def = this._proto;this.$attr_accessor("name");
      def.$attributes = function() {

        return $hash2(["name"], {"name": this.$name()});
      };
      def['$attributes='] = function(attributes) {
        var $a, $b, TMP_3;
        if (($a = attributes['$is_a?']((($b = $scope.Hash) == null ? $opal.cm("Hash") : $b))) === false || $a === nil) {
          this.$raise()
        };
        return ($a = ($b = attributes).$each_pair, $a._p = (TMP_3 = function(key, value) {

          var self = TMP_3._s || this;
          if (key == null) key = nil;
if (value == null) value = nil;

          return self.$send("" + (key) + "=", value)
        }, TMP_3._s = this, TMP_3), $a).call($b);
      };
      return def.$talk = function(text) {

        return this.$puts("[" + (this.$name()) + "] " + (text));
      };}).call(self.$singleton_class())
    }, TMP_2._s = this, TMP_2), $a).call($b));
    klass = this.$class().$const_get(class_sym);
    klass['$attributes='](((($a = $opal.$yieldX($yield, [])) === $breaker) ? $breaker.$v : $a));
    return klass;
  };
  self.scene_map = $hash2([], {});
  def.$scene_def = function(scene_name, block) {

    if (this.scene_map == null) this.scene_map = nil;

    return this.scene_map['$[]='](scene_name, block);
  };
  def.$scene_run = function(scene_name) {

    if (this.scene_map == null) this.scene_map = nil;

    return this.scene_map['$[]'](scene_name).$call();
  };
  def.$scene = TMP_4 = function(scene_name) {
    var TMP_5, $a, $b, $iter = TMP_4._p, $yield = $iter || nil;TMP_4._p = null;
    if (($yield !== nil)) {
      return this.$scene_def(scene_name, ($a = ($b = this).$lambda, $a._p = (TMP_5 = function() {

        var self = TMP_5._s || this, $a;

        return $a = $opal.$yieldX($yield, []), $a === $breaker ? $a : $a
      }, TMP_5._s = this, TMP_5), $a).call($b))
    } else {
      return this.$scene_run(scene_name)
    };
  };
  return def.$chapter = TMP_6 = function(chapter_name) {
    var $a, $iter = TMP_6._p, $yield = $iter || nil;TMP_6._p = null;
    return $a = $opal.$yieldX($yield, []), $a === $breaker ? $a : $a;
  };
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/lemonade.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var TMP_1, $a, $b, TMP_2, $c, TMP_3, $d, TMP_4, $e, TMP_5, $f, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $hash2 = $opal.hash2;

  $opal.add_stubs(['$entity', '$talk', '$scene', '$chapter']);
  ;
  ($a = ($b = self).$entity, $a._p = (TMP_1 = function() {

    var self = TMP_1._s || this;

    return $hash2(["name"], {"name": "レモン"})
  }, TMP_1._s = self, TMP_1), $a).call($b, "Lemon");
  ($a = ($c = self).$entity, $a._p = (TMP_2 = function() {

    var self = TMP_2._s || this;

    return $hash2(["name"], {"name": "エード"})
  }, TMP_2._s = self, TMP_2), $a).call($c, "Ade");
  ($a = ($d = self).$scene, $a._p = (TMP_3 = function() {

    var self = TMP_3._s || this, $a;

    return (($a = $scope.Lemon) == null ? $opal.cm("Lemon") : $a).$talk("Hello world!")
  }, TMP_3._s = self, TMP_3), $a).call($d, "one");
  ($a = ($e = self).$scene, $a._p = (TMP_4 = function() {

    var self = TMP_4._s || this, $a;

    (($a = $scope.Lemon) == null ? $opal.cm("Lemon") : $a).$talk("はじめまして！");
    (($a = $scope.Lemon) == null ? $opal.cm("Lemon") : $a).$talk("私はレモンです");
    (($a = $scope.Ade) == null ? $opal.cm("Ade") : $a).$talk("僕はエード");
    return (($a = $scope.Ade) == null ? $opal.cm("Ade") : $a).$talk("よろしくお願いします");
  }, TMP_4._s = self, TMP_4), $a).call($e, "two");
  return ($a = ($f = self).$chapter, $a._p = (TMP_5 = function() {

    var self = TMP_5._s || this;

    self.$scene("one");
    return self.$scene("two");
  }, TMP_5._s = self, TMP_5), $a).call($f, "first");
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/application.lem.js.map
;
