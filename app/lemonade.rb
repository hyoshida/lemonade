require 'opal'
require 'opal-jquery'


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
        end
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
