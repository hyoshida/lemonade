module Lemonade
  module Entity
    class Base
      def initialize(attributes)
        self.attributes = attributes
      end

      def id
        @id
      end

      def id=(id)
        @id = id
      end

      # なぜかattr_accessorがうまく動作しないので独自に定義
      def name
        @name
      end

      def name=(name)
        @name = name
      end

      def attributes
        { id: self.id, name: self.name }
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
