module Lemonade
  module Entity
    class Base
      attr_accessor :colmuns
      attr_accessor :id

      def initialize(attributes=nil)
        return if attributes.nil?
        colmuns = attributes.keys.map(&:to_sym)
        self.singleton_class.class_eval { attr_accessor *colmuns }
        self.colmuns = colmuns
        self.attributes = attributes
      end

      def attributes
        default_attributes = { id: self.id }
        self.colmuns.inject(default_attributes) do |result,colmun|
          result[colmun] = self.send colmun
          result
        end
      end

      def attributes=(attributes)
        raise unless attributes.is_a? Hash
        attributes.each_pair do |key,value|
          self.send "#{key}=", value
        end
      end

      def show_or_add_element
        Document.ready? do
          element = ::Element.id(self.id)
          return show_element if element
          add_element
          show_element
        end
      end

      def add_element
        Document.ready? do
          element = ::Element.id(self.id)
          return if element
          element = ::Element.new
          element.id = self.id
          element.add_class('entity')
          element.hide
          element.append_to_body
          element
        end
      end

      def show_element
        Document.ready? do
          element = ::Element.id(self.id)
          return if element.nil?
          return if element.show?
          element.css(:opacity, 0.0)
          element.css(:display, 'block')
          replace_entities!
          element.fade_in(duration: 400)
        end
      end

      def hide_or_remove_element
        Document.ready? do
          element = ::Element.id(self.id)
          return remove_element unless element.visible?
          hide_element
        end
      end

      def remove_element
        Document.ready? do
          element = ::Element.id(self.id)
          return if element.nil?
          element.remove
        end
      end

      def hide_element
        Document.ready? do
          element = ::Element.id(self.id)
          return if element.nil?
          return if element.hidden?
          element.fade_out(duration: 400) do
            replace_entities!
          end
        end
      end

      private

      def replace_entities!
        entities = ::Element.find('.entity:visible')
        percentage = 100 / entities.length
        entities.each_with_index do |entity,i|
          entity.css(left: "#{percentage * i}%")
        end
        entities.transition(width: "#{percentage}%")
      end

      def animation_for(element, options = { randomOrder: false, time: 500, reset: true })
        `element.lettering().animateLetters({ opacity: 0 }, { opacity: 1 }, #{options.to_n});`
      end
    end
  end
end
