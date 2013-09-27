novel 'Lemonade' do
  entity(:lemon) { Anima.new(name: 'レモン') }
  entity(:ade) { Anima.new(name: 'エード') }

  scene :one do
    lemon.talk('Hello world!')
  end

  scene :two do
    lemon.talk('はじめまして！')
    lemon.talk('私はレモンです')
    ade.talk('僕はエード')
    ade.talk('よろしくお願いします')
  end

  scene :three do
    lemon.talk('ひとりひとりが')
    ade.talk('順番に喋ることもできます')

    event do
      lemon.name = '？？？'
      lemon.add_talk('名前を変えるのだって簡単！')
    end
  end

  chapter :first do
    scene :one
    scene :two
    scene :three
  end
end
