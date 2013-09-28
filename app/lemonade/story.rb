module Lemonade
  module Story
    # XXX: なぜか出る「uninitialized constant Object::Anima」エラー対策
    Object::Anima = Entity::Anima

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

    def self.entity(name, &block)
      define_singleton_method(name) do
        @assignments ||= {}
        @assignments[name] ||= instance_eval(&block)
      end
    end

    def self.scene(scene_name)
      if block_given?
        scene_def(scene_name, -> { yield })
      else
        scene_run(scene_name)
      end
    end

    def self.chapter(chapter_name)
      instance_eval { yield }
    end

    def self.event(*args, &block)
      Event.new(*args, &block).save
    end

    def self.step
      Event.exec
    end

    private

    def self.scene_def(scene_name, block)
      @scene_map ||= {}
      @scene_map[scene_name] = block
    end

    def self.scene_run(scene_name)
      @scene_map[scene_name].call
    end
  end
end
