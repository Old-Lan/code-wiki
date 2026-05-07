package handler

type Request struct {
	Body string
}

type Serializer interface {
	Serialize() ([]byte, error)
	Deserialize(data []byte) error
}

const MaxRetries = 3

var DefaultTimeout = 30
