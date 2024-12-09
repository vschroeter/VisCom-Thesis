from typing import TypeVar, Generic, Type

T = TypeVar('T')

class Test[T]:
    def __init__(self, cls: Type[T]):
        self.t = cls()

example_instance = Test(cls=int)
print(type(example_instance.t))  # Outputs: <class '__main__.Example'>


class Test(Generic[T]):
    def __init__(self):
        # Access the actual type argument at runtime
        print(self.__dir__())
        t_type = self.__orig_class__.__args__[0]
        self.t = t_type()  # Instantiate the type
        
        
example_instance = Test[int]()
print(type(example_instance.t))  # Outputs: <class '__main__.Example'>