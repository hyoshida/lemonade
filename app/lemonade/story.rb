module Lemonade
  module Story
    def self.novel(*args, &story_block)
      @_subclass_count ||= 0
      @_subclass_count += 1
      args << {} unless args.last.is_a?(Hash)
      args.last.update(story_block: story_block)

      child = const_set(
        "Nested_#{@_subclass_count}",
        subclass(self, args, &story_block)
      )
      @children ||= []
      @children << child
      child
    end

    def self.subclass(parent, args, &story_block)
      subclass = Class.new(parent)
      subclass.module_eval(&story_block) if story_block
      subclass
    end

    def self.entity(class_sym)
      raise unless block_given?

      klass = spawn_model(class_sym)
      klass.attributes = yield
      klass
    end

    def self.scene(scene_name)
      if block_given?
        scene_def(scene_name, -> { yield })
      else
        scene_run(scene_name)
      end
    end

    def self.chapter(chapter_name)
      self.instance_eval { yield }
    end

    private

    def self.spawn_model(class_sym, &block)
      Object.instance_eval { remove_const class_sym } if Object.const_defined?(class_sym)
      Object.const_set(class_sym, Class.new).send(:extend, Entity)
      Object.const_get(class_sym).class_eval(&block) if block_given?
      Object.const_get(class_sym)
    end

    def self.scene_def(scene_name, block)
      @scene_map ||= {}
      @scene_map[scene_name] = block
    end

    def self.scene_run(scene_name)
      @scene_map[scene_name].call
    end
  end
end
