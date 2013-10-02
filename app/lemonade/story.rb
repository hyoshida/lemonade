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
        @assignments[name].id = name
        @assignments[name]
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

    def self.question(*args, &block)
      Event.new { question! *args, &block }.save
    end

    def self.question!(text, options, &block)
      Document.ready? do
        paragraph = ::Element.new('p')
        paragraph.text = text

        question = Question.find_or_initialize
        question.html = paragraph

        answers = Answers.find_or_initialize(parent: question, tag: 'ul')

        options.each_pair do |key,value|
          answer = ::Element.new('li')
          answer.add_class('answer')
          answer.add_class("answer_#{key}")
          answer.text = value
          answers.append(answer)

          Document.on(:click, ".answer_#{key}") do |event|
            question.remove
            # 通常のイベント処理を有効化
            on_step_event
            # イベントの割り込み挿入
            Event.unshift(Event.new(key, &block))
            # イベント実行
            Document.trigger(:step)
            event.stop_propagation
          end
        end

        # 通常のイベント処理を無効化
        off_step_event
      end
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
