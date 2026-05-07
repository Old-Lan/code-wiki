package main

import (
	"fmt"
	"github.com/example/go-simple/handler"
)

func main() {
	fmt.Println("starting")
	h := handler.NewHandler()
	h.Serve()
}
