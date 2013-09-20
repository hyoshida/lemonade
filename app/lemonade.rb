require 'opal'
require 'opal-jquery'
require 'json'

def javascripts
  [
    'https://rawgithub.com/giuliandrimba/jquery-lettering-animate/master/example/js/jquery.lettering.js',
    'https://rawgithub.com/giuliandrimba/jquery-lettering-animate/master/example/js/jquery.lettering.animate.js'
  ]
end

def import_javascripts
  javascripts.each do |javascript|
    `document.write('<script type="text/javascript" src="' + javascript + '"><\/script>');`
  end
end

import_javascripts

def entity(class_sym)
  raise unless block_given?

  self.class.const_set class_sym, Class.new {
    class << self
      attr_accessor :name

      def attributes
        { name: self.name }
      end

      def attributes=(attributes)
        raise unless attributes.is_a? Hash
        attributes.each_pair do |key,value|
          self.send "#{key}=", value
        end
      end

      def talk(text)
        add_talk_element "[#{self.name}] #{text}"
      end

      private

      def add_talk_element(text)
        Document.ready? do
          paragraph = Element.new('p')
          paragraph.text = text
          paragraph.append_to_body
          animation_for(paragraph)
        end
      end

      def animation_for(element, options = { randomOrder: false, time: 500, reset: true })
        `element.lettering().animateLetters({ opacity: 0 }, { opacity: 1 }, #{options.to_n});`
      end
    end
  }

  klass = self.class.const_get(class_sym)
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
