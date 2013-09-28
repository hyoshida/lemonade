module Lemonade
  class Element
    class << self
      alias_method :original_new, :new

      def new(options={})
        element = ::Element.new
        element.id = options[:id] || self.default_id
        if options[:parent]
          options[:parent].append(element)
        else
          element.append_to_body
        end
        element
      end

      def default_id
        self.name.gsub(/.+::/, '').downcase
      end

      alias_method :original_id, :id

      def find(id=nil)
        ::Element.id(id || self.default_id)
      end

      def find_or_initialize(options={})
        element = self.find(options[:id])
        return element if element
        self.new(options)
      end
    end
  end

  class MessageBox < Element; end
  class Talk < Element; end
  class Name < Element; end
end
