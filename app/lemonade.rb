require 'opal'
require 'opal-jquery'
require 'json'

require 'javascript_importer'
require 'entity'

JavascriptImporter.new(%w{
  https://rawgithub.com/giuliandrimba/jquery-lettering-animate/master/example/js/jquery.lettering.js
  https://rawgithub.com/giuliandrimba/jquery-lettering-animate/master/example/js/jquery.lettering.animate.js
}).exec

def spawn_model(class_sym, &block)
  Object.instance_eval { remove_const class_sym } if Object.const_defined?(class_sym)
  Object.const_set(class_sym, Class.new).send(:extend, Entity)
  Object.const_get(class_sym).class_eval(&block) if block_given?
  Object.const_get(class_sym)
end

def entity(class_sym)
  raise unless block_given?

  klass = spawn_model(class_sym)
  klass.attributes = yield
  klass
end

@scene_map = {}

def scene_def(scene_name, block)
  @scene_map[scene_name] = block
end

def scene_run(scene_name)
  @scene_map[scene_name].call
end

def scene(scene_name)
  if block_given?
    scene_def(scene_name, -> { yield })
  else
    scene_run(scene_name)
  end
end

def chapter(chapter_name)
  yield
end
