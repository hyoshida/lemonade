module Lemonade
  module Entity
    ID_TAILK = :talk

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

    def add_talk(text)
      add_talk_element "[#{self.name}] #{text}"
    end

    def talk(text)
      Event.new { add_talk text }.save
    end

    private

    def add_talk_element(text)
      Document.ready? do
        paragraph = Element.id(ID_TAILK)
        if paragraph.nil?
          paragraph = Element.new('p')
          paragraph.id = ID_TAILK
          paragraph.append_to_body
        end
        paragraph.text = text
        animation_for(paragraph)
      end
    end

    def animation_for(element, options = { randomOrder: false, time: 500, reset: true })
      `element.lettering().animateLetters({ opacity: 0 }, { opacity: 1 }, #{options.to_n});`
    end
  end
end
