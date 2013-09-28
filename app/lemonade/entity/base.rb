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
          return element.show if element
          element = ::Element.new
          element.id = self.id
          element.add_class('entity')
          element.append_to_body
        end
      end

      private

      def animation_for(element, options = { randomOrder: false, time: 500, reset: true })
        `element.lettering().animateLetters({ opacity: 0 }, { opacity: 1 }, #{options.to_n});`
      end
    end
  end
end
