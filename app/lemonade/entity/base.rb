module Lemonade
  module Entity
    class Base
      def initialize(attributes)
        self.attributes = attributes
      end

      # なぜかattr_accessorがうまく動作しないので独自に定義
      def name
        @name
      end

      def name=(name)
        @name = name
      end

      def attributes
        { name: self.name }
      end

      def attributes=(attributes)
        raise unless attributes.is_a? Hash
        attributes.each_pair do |key,value|
          self.send "#{key}=", value
        end
      end

      private

      def animation_for(element, options = { randomOrder: false, time: 500, reset: true })
        `element.lettering().animateLetters({ opacity: 0 }, { opacity: 1 }, #{options.to_n});`
      end
    end
  end
end
