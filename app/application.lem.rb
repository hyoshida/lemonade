entity :Lemon do
  { name: 'レモン' }
end

entity :Ade do
  { name: 'エード' }
end

scene :one do
  Lemon.talk('Hello world!')
end

scene :two do
  Lemon.talk('はじめまして！')
  Lemon.talk('私はレモンです')
  Ade.talk('僕はエード')
  Ade.talk('よろしくお願いします')
end

chapter :first do
  scene :one
  scene :two
end
